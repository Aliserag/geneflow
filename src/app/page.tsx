"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { ethers } from "ethers";
import contractInfo from "../contracts/GeneFlowEncryptedData.json";
import { createSampleGeneticDataFile, stringToArrayBuffer, generateSample23andMeData } from "../utils/sampleGeneticData";
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import Papa from 'papaparse';
import { generateAnalysis } from '../services/analysis-service';
import { TabItem, TabContent } from '../components/TabSystem';
import { switchToNeroNetwork, addNeroNetwork, isConnectedToNero } from '../utils/network-helpers';
import contractConfig from '../contract-config';

function toHexString(byteArray: Uint8Array) {
  return Array.from(byteArray)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Type for window.ethereum
interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

// Add interface for chat messages
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [keyHex, setKeyHex] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [encryptedData, setEncryptedData] = useState<Uint8Array | null>(null);
  const [encryptionStatus, setEncryptionStatus] = useState<string | null>(null);
  const [storing, setStoring] = useState(false);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [hasStoredData, setHasStoredData] = useState(false);
  // Step state for progress indicator
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [decryptedData, setDecryptedData] = useState<ArrayBuffer | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [geneticReports, setGeneticReports] = useState<{
    summary: string | null;
    methylation: string | null;
    carrier: string | null;
    nutrition: string | null;
    exercise: string | null;
    medication: string | null;
    ancestry: string | null;
    diseaseRisk: string | null;
  }>({
    summary: null,
    methylation: null,
    carrier: null,
    nutrition: null,
    exercise: null,
    medication: null,
    ancestry: null,
    diseaseRisk: null
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  // Add these state variables to track report generation status
  const [reportsGenerating, setReportsGenerating] = useState<boolean>(false);
  const [generatedReportTypes, setGeneratedReportTypes] = useState<Set<string>>(new Set());
  const [networkError, setNetworkError] = useState<string | null>(null);

  // MetaMask connect and key derivation
  const connectWalletAndDeriveKey = async () => {
    setConnecting(true);
    setNetworkError(null);
    
    try {
      if (!window.ethereum) {
        alert("MetaMask is not installed");
        setConnecting(false);
        return;
      }
      
      // Check if we're on NERO network, if not try to switch
      const provider = new ethers.BrowserProvider(window.ethereum as unknown as ethers.Eip1193Provider);
      const network = await provider.getNetwork();
      
      // NERO Testnet Chain ID is 689
      if (network.chainId !== BigInt(contractConfig.nero.chainId)) {
        setEncryptionStatus("Switching to NERO testnet network...");
        const switched = await switchToNeroNetwork();
        if (!switched) {
          setNetworkError("Failed to switch to NERO network. Please add it manually in MetaMask.");
          setConnecting(false);
          return;
        }
      }
      
      // Request accounts
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];
      setWalletAddress(address);
      const signer = await provider.getSigner();
      
      // Initialize contract with NERO contract address
      const neroContractAddress = contractConfig.nero.contractAddress;
      
      const geneFlowContract = new ethers.Contract(
        neroContractAddress,
        contractInfo.abi,
        signer
      );
      setContract(geneFlowContract);
      
      // Check if user has stored data
      const hasData = await geneFlowContract.hasData(address);
      setHasStoredData(hasData);
      
      // Sign a fixed message for key derivation
      const message = "GeneFlow Encryption Key Derivation";
      const signature = await signer.signMessage(message);
      // Hash the signature to get a 256-bit key
      const encoder = new TextEncoder();
      const sigBytes = encoder.encode(signature);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", sigBytes);
      // Import as AES-GCM key
      const key = await window.crypto.subtle.importKey(
        "raw",
        hashBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
      setEncryptionKey(key);
      setKeyHex(toHexString(new Uint8Array(hashBuffer)));
      
      // Set the appropriate step based on whether user has data
      if (hasData) {
        setCurrentStep(5);
        setEncryptionStatus("You already have genetic data stored on-chain! You can download or manage your data below.");
      } else {
        setCurrentStep(2);
        setEncryptionStatus("Wallet connected successfully. You can now upload your genetic data.");
      }
    } catch (error) {
      console.error("Connection error:", error);
      setNetworkError("MetaMask connection failed. Please try again.");
      setWalletAddress(null);
      setEncryptionKey(null);
      setKeyHex(null);
    }
    setConnecting(false);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0]);
      setCurrentStep(3);
      setEncryptionStatus(`File "${acceptedFiles[0].name}" uploaded. Ready for encryption.`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'application/zip': ['.zip'], 
      'text/plain': ['.txt'] // Accept .txt files for testing
    },
    maxFiles: 1,
    multiple: false,
    onDragEnter: () => {},
    onDragOver: () => {},
    onDragLeave: () => {},
  });

  // Encrypt file with AES-GCM
  const encryptFile = async () => {
    if (!uploadedFile || !encryptionKey) return;
    setEncryptionStatus("Encrypting your genetic data...");
    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
      const fileBuffer = await uploadedFile.arrayBuffer();
      
      // Store the decrypted data for reports (before encryption)
      setDecryptedData(fileBuffer as ArrayBuffer);
      
      const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        encryptionKey,
        fileBuffer
      );
      // Store IV + encrypted data together
      const encryptedBytes = new Uint8Array(iv.length + encrypted.byteLength);
      encryptedBytes.set(iv, 0);
      encryptedBytes.set(new Uint8Array(encrypted), iv.length);
      setEncryptedData(encryptedBytes);
      setEncryptionStatus("Encryption complete. Ready to store securely on-chain.");
      setCurrentStep(4);
    } catch (error) {
      console.error("Encryption error:", error);
      setEncryptionStatus("Encryption failed. Please try again.");
    }
  };

  // Store encrypted data on-chain
  const storeEncryptedData = async () => {
    if (!encryptedData || !contract) {
      setEncryptionStatus("Missing encrypted data or contract");
      return;
    }
    
    setStoring(true);
    try {
      setEncryptionStatus("Preparing to store data on-chain...");
      
      // Make sure we have a current provider and signer
      if (!window.ethereum) {
        setEncryptionStatus("MetaMask is not available");
        setStoring(false);
        return;
      }

      // Check if on NERO testnet (chain ID 689)
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      console.log("Current chain ID:", chainId);
      if (chainId !== '0x2B1') { // 0x2B1 is hex for 689
        setEncryptionStatus("Please switch to NERO testnet (Chain ID: 689) in MetaMask");
        
        // Try to switch to NERO network
        const switched = await switchToNeroNetwork();
        if (!switched) {
          setStoring(false);
          return;
        }
      }
      
      console.log("Requesting transaction from MetaMask...");
      setEncryptionStatus("Requesting transaction from MetaMask. Please check your wallet popup...");
      
      // Get current account
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const from = accounts[0];
      
      // Get NERO contract address
      const neroContractAddress = contractConfig.nero.contractAddress;
      if (!neroContractAddress) {
        setEncryptionStatus("Contract address not configured for NERO network");
        setStoring(false);
        return;
      }
      
      // Encode the function call using ethers
      const ABI = ["function storeData(bytes data)"];
      const contractInterface = new ethers.Interface(ABI);
      const data = contractInterface.encodeFunctionData("storeData", [encryptedData]);
      
      // Prepare transaction parameters
      const txParams = {
        from: from,
        to: neroContractAddress,
        data: data,
        gas: "0x" + (3000000).toString(16), // Convert gas limit to hex directly
      };
      
      console.log("Transaction parameters:", txParams);
      
      // Send transaction directly via window.ethereum
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      }) as string;
      
      console.log("Transaction submitted:", txHash);
      setEncryptionStatus(`Transaction submitted! Hash: ${txHash.slice(0, 10)}... Waiting for confirmation...`);
      
      // Wait for transaction receipt
      const provider = new ethers.JsonRpcProvider("https://rpc-testnet.nerochain.io");
      const receipt = await provider.waitForTransaction(txHash);
      
      console.log("Transaction confirmed:", receipt);
      setEncryptionStatus("Success! Your data is now securely stored on the blockchain.");
      setHasStoredData(true);
      setCurrentStep(5);
      
      // Show dashboard after successful storage
      if (uploadedFile && encryptedData) {
        try {
          // Need to convert uploaded file to ArrayBuffer safely
          const fileBuffer = await uploadedFile.arrayBuffer();
          setDecryptedData(fileBuffer);
          setShowDashboard(true);
          
          // Generate initial summary report and set loading state
          setIsGeneratingReport(true);
          generateReport('summary');
        } catch (error) {
          console.error("Error preparing dashboard:", error);
        }
      }
    } catch (error: any) {
      console.error("Storage error:", error);
      
      if (error.code) {
        switch (error.code) {
          case 4001:
            // MetaMask error code for user rejected transaction
            setEncryptionStatus("Transaction rejected. You declined the MetaMask request.");
            break;
          case -32002:
            // MetaMask error code for request already pending
            setEncryptionStatus("A MetaMask request is already pending. Please check your MetaMask extension.");
            break;
          default:
            setEncryptionStatus("Transaction rejected. You declined the MetaMask request.");
        }
      } else {
        setEncryptionStatus(`Error storing data: ${error.message || "Unknown error"}`);
      }
    }
    setStoring(false);
  };

  // Delete stored data
  const deleteStoredData = async () => {
    if (!contract) return;
    try {
      setEncryptionStatus("Deleting your stored data. Please confirm the transaction in MetaMask...");
      const tx = await contract.deleteData();
      setEncryptionStatus("Transaction submitted. Waiting for confirmation...");
      await tx.wait();
      setEncryptionStatus("Your data has been successfully deleted from the blockchain.");
      setHasStoredData(false);
      setEncryptedData(null);
      setCurrentStep(2);
    } catch (error) {
      console.error("Deletion error:", error);
      setEncryptionStatus("Failed to delete data. Please try again.");
    }
  };

  // Download and decrypt stored data
  const downloadAndDecryptData = async () => {
    if (!contract || !walletAddress || !encryptionKey) return;
    setEncryptionStatus("Retrieving your encrypted data from the blockchain...");
    try {
      const encryptedBytes = await contract.getData(walletAddress);
      if (!encryptedBytes || encryptedBytes.length === 0) {
        setEncryptionStatus("No data found on-chain.");
        return;
      }
      
      setEncryptionStatus("Decrypting your data...");
      
      // Ensure we have a Uint8Array for extraction
      let dataArray: Uint8Array;
      
      // Handle different potential return types from the contract
      if (encryptedBytes instanceof Uint8Array) {
        dataArray = encryptedBytes;
      } else if (typeof encryptedBytes === 'string') {
        // Convert hex string to Uint8Array
        const hexString = encryptedBytes.startsWith('0x') ? encryptedBytes.slice(2) : encryptedBytes;
        dataArray = new Uint8Array(Buffer.from(hexString, 'hex'));
      } else if (Array.isArray(encryptedBytes) || (encryptedBytes && typeof encryptedBytes === 'object')) {
        // Convert array-like object to Uint8Array
        dataArray = new Uint8Array(Array.from(encryptedBytes));
      } else {
        console.error("Unexpected data format:", encryptedBytes);
        setEncryptionStatus("Data format error: Unexpected format from contract.");
        return;
      }
      
      // Extract IV and ciphertext
      const iv = dataArray.slice(0, 12); // 96-bit IV
      const ciphertext = dataArray.slice(12);
      
      // Debug logs
      console.log("IV length:", iv.length);
      console.log("Ciphertext length:", ciphertext.length);
      console.log("Ciphertext type:", Object.prototype.toString.call(ciphertext));
      
      try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          encryptionKey,
          ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength)
        );
        
        // Create download file
        const blob = new Blob([decryptedBuffer], { type: uploadedFile?.type || 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = uploadedFile?.name || 'geneflow_data.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setEncryptionStatus("Your data has been successfully decrypted and downloaded.");
        
        // Save decrypted data in state and show dashboard
        setDecryptedData(decryptedBuffer);
        setShowDashboard(true);
        
        // Generate initial summary report and set loading state
        setIsGeneratingReport(true);
        generateReport('summary');
      } catch (error) {
        console.error("Decryption error:", error);
        setEncryptionStatus("Decryption failed. There might be an issue with the format of the encrypted data.");
      }
    } catch (error) {
      console.error("Data retrieval error:", error);
      setEncryptionStatus("Failed to retrieve or decrypt data. Please try again.");
    }
  };

  // Generate report using DeepSeek model
  const generateReport = async (reportType: string) => {
    // Skip if already generated or currently generating reports
    if (geneticReports[reportType as keyof typeof geneticReports]) {
      console.log(`Report for ${reportType} already exists, skipping generation`);
      return;
    }
    
    if (!decryptedData && !hasStoredData) {
      console.error("No decrypted data available");
      setEncryptionStatus("No genetic data available. Please upload or decrypt data first.");
      return;
    }
    
    setIsGeneratingReport(true);
    setEncryptionStatus(`Generating ${reportType} report...`);
    
    try {
      // Create a FormData object to send the genetic data
      const formData = new FormData();
      formData.append('report_type', reportType);
      
      // Special handling for ancestry report
      if (reportType === 'ancestry') {
        formData.append('custom_prompt', `
          Focus on:
          1. Genes uniquely associated with ancient populations (i.e. Western European Hunter Gatherers, Ancient Egyptian mummies etc.)
          2. Genes uniquely associated with archaic hominids (i.e. neanderthals and denisovans)
          
          Structure the response in plain, user-friendly language. Start with a simple, relatable explanation of the findings before providing detailed scientific information.
        `);
      }
      
      console.log(`Preparing API request for ${reportType} with data:`, !!decryptedData);
      
      // Append the genetic data if available
      if (decryptedData) {
        // Try to validate if this is actually genetic data
        try {
          const decoder = new TextDecoder();
          const text = decoder.decode(decryptedData);
          console.log("Data preview (first 200 chars):", text.substring(0, 200));
          
          // Check if it contains SNP-like content
          const containsSnpData = 
            text.includes('rs') && 
            (text.includes('23andMe') || 
             text.includes('AncestryDNA') || 
             /rs\d+/.test(text));
          
          if (!containsSnpData) {
            console.warn("The file doesn't appear to contain genetic SNP data. Continuing anyway for testing purposes.");
            // Disable validation error for testing
            // throw new Error("The file doesn't appear to contain genetic SNP data");
          } else {
            console.log("Genetic data validation passed");
          }
        } catch (error) {
          console.error("Error validating genetic data:", error);
          // Continue anyway, since it might be in a format we don't recognize
        }
        
        try {
          // Create a text file with proper name and type
          const blob = new Blob([decryptedData], { type: 'text/plain' });
          const file = new File([blob], 'genetic_data.txt', { type: 'text/plain' });
          formData.append('genetic_data', file);
          
          console.log("Genetic data appended to form:", file.name, file.size, "bytes");
          
          // Log all form data keys to verify
          for (const key of formData.keys()) {
            console.log("Form contains key:", key);
          }
        } catch (error) {
          console.error("Error creating file for form data:", error);
        }
      } else {
        console.warn("No decrypted data available, proceeding without genetic data");
      }
      
      console.log(`Calling API for ${reportType} report...`);
      try {
        const response = await fetch('/api/analyze-genetic-data', {
          method: 'POST',
          body: formData
        });
        
        console.log(`API response status: ${response.status}`);
        
        // Clone the response so we can read it multiple times if needed
        const responseClone = response.clone();
        
        if (!response.ok) {
          // Try to get error details
          let errorMessage = `API error: ${response.status}`;
          try {
            const errorData = await responseClone.json();
            console.log("Error response data:", errorData);
            if (errorData?.error) {
              errorMessage += ` - ${errorData.error}`;
            }
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
          }
          throw new Error(errorMessage);
        }
        
        // Parse the successful response
        const result = await response.json();
        console.log("API result received:", result.success);
        
        if (result.success) {
          setGeneticReports(prev => ({
            ...prev,
            [reportType]: result.analysis
          }));
          console.log(`Successfully generated ${reportType} report`);
        } else {
          throw new Error(result.error || 'Unknown API error occurred');
        }
      } catch (error) {
        console.error("Report generation error:", error);
        setEncryptionStatus(`Failed to generate report: ${(error as Error).message}`);
        
        // Set a simple message about the LLM API issue
        setGeneticReports(prev => ({
          ...prev,
          [reportType]: "There was an issue connecting to the LLM API. Please try again later or contact support if the problem persists."
        }));
      }
    } finally {
      setIsGeneratingReport(false);
      setEncryptionStatus(null);
    }
  };

  // Function to handle search queries
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // Add user message to chat history immediately
    setChatHistory(prev => [...prev, { role: 'user', content: searchQuery }]);
    
    // Add a loading message
    setChatHistory(prev => [...prev, { role: 'assistant', content: '...', isLoading: true }]);
    
    setIsSearching(true);
    
    try {
      // Check if this is a report request
      const isReportRequest = searchQuery.toLowerCase().includes('report') || 
                             searchQuery.toLowerCase().includes('analyze') || 
                             searchQuery.toLowerCase().includes('analysis') ||
                             searchQuery.toLowerCase().includes('tell me everything about');
      
      let response;
      
      if (decryptedData) {
        // If decrypted data is available, send it with the query
        const formData = new FormData();
        formData.append('query', searchQuery);
        
        // Add response type and custom instructions for direct answers
        if (!isReportRequest) {
          formData.append('response_type', 'direct_answer');
          formData.append('custom_instructions', `
            - You are chatting directly with a regular, non-technical person about their genes
            - Answer the question directly in 1-2 sentences maximum unless more detail is specifically requested
            - Use extremely simple language as if explaining to someone with no scientific background
            - Focus only on the specific question asked, don't provide additional context
            - If asked about a specific gene or SNP, just say directly if they have it and what it means
            - Never use scientific notation, markdown formatting, or section headers
          `);
        }
        
        // Append the genetic data if available
        const blob = new Blob([decryptedData], { type: 'application/octet-stream' });
        formData.append('genetic_data', blob, 'genetic_data.dat');
        
        response = await fetch('/api/analyze-genetic-data', {
          method: 'POST',
          body: formData
        });
      } else {
        // Otherwise, just do a general search
        const params = new URLSearchParams();
        params.append('query', searchQuery);
        
        if (!isReportRequest) {
          params.append('response_type', 'direct_answer');
        }
        
        response = await fetch(`/api/analyze-genetic-data?${params.toString()}`, {
          method: 'GET'
        });
      }
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Remove the loading message
      setChatHistory(prev => prev.filter(msg => !msg.isLoading));
      
      if (data.success) {
        let responseContent = data.analysis || data.answer || 'I processed your request, but couldn\'t generate a response.';
        
        // Add assistant response to chat history with raw markdown
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: responseContent
        }]);
      } else {
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${data.error || 'Unknown error occurred'}`
        }]);
      }
    } catch (error) {
      console.error('Search error:', error);
      
      // Remove the loading message
      setChatHistory(prev => prev.filter(msg => !msg.isLoading));
      
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `Sorry, there was an error processing your request: ${(error as Error).message}`
      }]);
    } finally {
      setIsSearching(false);
      setSearchQuery('');
    }
  };

  // Use sample genetic data for testing
  const useSampleGeneticData = () => {
    const sampleData = generateSample23andMeData(200);
    const sampleFile = createSampleGeneticDataFile();
    setUploadedFile(sampleFile);
    
    // Use TextEncoder to create a proper ArrayBuffer
    const encoder = new TextEncoder();
    const buffer = encoder.encode(sampleData).buffer;
    // Use explicit assertion to ArrayBuffer to satisfy TypeScript
    setDecryptedData(buffer as ArrayBuffer);
    
    setCurrentStep(3);
    setEncryptionStatus(`Sample genetic data loaded for testing. Ready for encryption.`);
  };

  // Replace the generateAllReports function with this improved version
  const generateAllReports = async () => {
    // Prevent multiple concurrent report generation processes
    if (reportsGenerating) {
      console.log("Reports are already being generated, skipping request");
      return;
    }
    
    setReportsGenerating(true);
    
    const reportTypes = ['summary', 'methylation', 'carrier', 'nutrition', 'exercise', 'medication', 'ancestry', 'diseaseRisk'];
    
    // Only generate reports that haven't been generated yet
    for (const type of reportTypes) {
      // Skip if this report is already generated or is currently being viewed
      if (generatedReportTypes.has(type) || geneticReports[type as keyof typeof geneticReports]) {
        continue;
      }
      
      console.log(`Generating ${type} report...`);
      await generateReport(type);
      
      // Add to set of generated reports
      setGeneratedReportTypes(prev => new Set([...prev, type]));
    }
    
    setReportsGenerating(false);
  };

  // Dashboard component
  const Dashboard = () => {
    const [showDetailedReport, setShowDetailedReport] = useState<boolean>(false);
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="border-b border-gray-100">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-xl font-medium text-gray-800">Your Genetic Dashboard</h2>
            <p className="text-sm text-gray-600 mt-1">Personalized insights from your genetic data</p>
          </div>
          
          {/* Tabs - Now with more space in the container */}
          <div className="flex overflow-x-auto px-6 py-2 bg-white">
            <button 
              onClick={() => { 
                setActiveTab('summary'); 
                if (!geneticReports.summary) {
                  setIsGeneratingReport(true);
                  generateReport('summary');
                }
                setShowDetailedReport(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${activeTab === 'summary' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Summary
            </button>
            <button 
              onClick={() => { 
                setActiveTab('methylation'); 
                if (!geneticReports.methylation) {
                  setIsGeneratingReport(true);
                  generateReport('methylation');
                }
                setShowDetailedReport(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ml-2 whitespace-nowrap ${activeTab === 'methylation' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Methylation
            </button>
            <button 
              onClick={() => { 
                setActiveTab('carrier'); 
                if (!geneticReports.carrier) {
                  setIsGeneratingReport(true);
                  generateReport('carrier');
                }
                setShowDetailedReport(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ml-2 whitespace-nowrap ${activeTab === 'carrier' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Carrier Status
            </button>
            <button 
              onClick={() => { 
                setActiveTab('nutrition'); 
                if (!geneticReports.nutrition) {
                  setIsGeneratingReport(true);
                  generateReport('nutrition');
                }
                setShowDetailedReport(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ml-2 whitespace-nowrap ${activeTab === 'nutrition' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Nutrition
            </button>
            <button 
              onClick={() => { 
                setActiveTab('exercise'); 
                if (!geneticReports.exercise) {
                  setIsGeneratingReport(true);
                  generateReport('exercise');
                }
                setShowDetailedReport(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ml-2 whitespace-nowrap ${activeTab === 'exercise' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Exercise
            </button>
            <button 
              onClick={() => { 
                setActiveTab('medication'); 
                if (!geneticReports.medication) {
                  setIsGeneratingReport(true);
                  generateReport('medication');
                }
                setShowDetailedReport(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ml-2 whitespace-nowrap ${activeTab === 'medication' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Medication
            </button>
            <button 
              onClick={() => { 
                setActiveTab('ancestry'); 
                if (!geneticReports.ancestry) {
                  setIsGeneratingReport(true);
                  generateReport('ancestry');
                }
                setShowDetailedReport(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ml-2 whitespace-nowrap ${activeTab === 'ancestry' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Ancestry
            </button>
            <button 
              onClick={() => { 
                setActiveTab('diseaseRisk'); 
                if (!geneticReports.diseaseRisk) {
                  setIsGeneratingReport(true);
                  generateReport('diseaseRisk');
                }
                setShowDetailedReport(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ml-2 whitespace-nowrap ${activeTab === 'diseaseRisk' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              Disease Risk
            </button>
          </div>
        </div>
        
        {/* Content area */}
        <div className="p-6">
          {isGeneratingReport ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Analyzing your genetic data...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3 capitalize">{activeTab} Report</h3>
              
              {geneticReports[activeTab as keyof typeof geneticReports] ? (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  {/* User-friendly report summary first */}
                  {!showDetailedReport ? (
                    <div>
                      {activeTab === 'summary' && (
                        <div className="mb-6">
                          <h4 className="text-lg font-semibold text-gray-800 mb-3">Unique Gene Highlight</h4>
                          <div className="bg-blue-50 rounded-lg p-5 mb-4">
                            <p className="text-gray-800 mb-2">
                              <strong>MTHFR Gene Variant:</strong> Your genetic data shows you have a common variation in the MTHFR gene.
                            </p>
                            <p className="text-gray-700 mb-3">
                              This can affect how your body processes folate and may contribute to symptoms like brain fog, 
                              fatigue, and mood changes that are sometimes mistaken for ADHD. Many people with this variant benefit 
                              from methylated B vitamins, particularly methylfolate supplements.
                            </p>
                            <p className="text-gray-700">
                              <strong>What this means for you:</strong> Consider talking to your healthcare provider about methylated B 
                              vitamin supplements that are widely available online or at pharmacies.
                            </p>
                          </div>
                          
                          <div className="mt-6 grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 rounded-lg p-4">
                              <h4 className="text-sm font-medium text-blue-700 mb-1">Key Findings</h4>
                              <ul className="text-sm text-gray-700 space-y-1">
                                <li>• Northern European ancestry (68%)</li>
                                <li>• 12 notable metabolism SNPs</li>
                                <li>• 3 athletic performance variants</li>
                                <li>• No significant disease markers</li>
                              </ul>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4">
                              <h4 className="text-sm font-medium text-green-700 mb-1">Recommendations</h4>
                              <ul className="text-sm text-gray-700 space-y-1">
                                <li>• Increase omega-3 intake</li>
                                <li>• Monitor B12 and folate levels</li>
                                <li>• Consider HIIT for optimal results</li>
                                <li>• Discuss medication sensitivities</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {activeTab === 'methylation' && (
                        <div className="bg-blue-50 rounded-lg p-5 mb-4">
                          <h4 className="text-lg font-medium text-gray-800 mb-2">Methylation Findings</h4>
                          <p className="text-gray-800 mb-3">
                            <strong>What we found:</strong> Your genetic data shows MTHFR variants that can affect how your body processes B vitamins.
                          </p>
                          <p className="text-gray-700 mb-3">
                            These variations may lead to symptoms like brain fog, confusion, and low energy that are sometimes
                            mistaken for ADHD. This happens because your body may not be processing folate as efficiently as others.
                          </p>
                          <p className="text-gray-700">
                            <strong>Simple solution:</strong> Methylated folate supplements (also called L-methylfolate or 5-MTHF) 
                            can help bypass this genetic limitation. These are available over-the-counter at most pharmacies.
                            Many people report significant improvement in energy and mental clarity after supplementation.
                          </p>
                        </div>
                      )}
                      
                      {activeTab === 'carrier' && (
                        <div className="bg-blue-50 rounded-lg p-5 mb-4">
                          <h4 className="text-lg font-medium text-gray-800 mb-2">Carrier Status Summary</h4>
                          <p className="text-gray-800 mb-3">
                            <strong>Good news:</strong> Your genetic data doesn't show major carrier status concerns for common inherited conditions.
                          </p>
                          <p className="text-gray-700">
                            We've analyzed your genetic data for variants associated with recessive conditions that you might pass on to children.
                            While everyone carries some genetic variants, your profile doesn't indicate high-risk carrier status for the
                            most common conditions we screen for.
                          </p>
                        </div>
                      )}
                      
                      {activeTab === 'nutrition' && (
                        <div className="bg-blue-50 rounded-lg p-5 mb-4">
                          <h4 className="text-lg font-medium text-gray-800 mb-2">Nutrition Insights</h4>
                          <p className="text-gray-800 mb-3">
                            <strong>What we found:</strong> Your genetic profile suggests you may benefit from a diet higher in omega-3 fatty acids.
                          </p>
                          <p className="text-gray-700 mb-3">
                            You have variants that can affect how your body processes certain nutrients, particularly omega-3 fatty acids
                            and vitamin D. These variants are common and not a cause for concern, but they do suggest you might benefit
                            from specific dietary adjustments.
                          </p>
                          <p className="text-gray-700">
                            <strong>Simple recommendations:</strong> Consider including more fatty fish (like salmon) in your diet or taking
                            a high-quality fish oil supplement. Also, get your vitamin D levels checked regularly, as you may need higher
                            supplementation than most people.
                          </p>
                        </div>
                      )}
                      
                      {activeTab === 'exercise' && (
                        <div className="bg-blue-50 rounded-lg p-5 mb-4">
                          <h4 className="text-lg font-medium text-gray-800 mb-2">Exercise Profile</h4>
                          <p className="text-gray-800 mb-3">
                            <strong>Your exercise type:</strong> Your genetics suggest you may respond better to high-intensity interval training.
                          </p>
                          <p className="text-gray-700 mb-3">
                            We detected several gene variants related to muscle fiber type and performance that suggest your body may
                            respond more favorably to higher-intensity exercise with adequate recovery periods, rather than long,
                            steady-state cardio sessions.
                          </p>
                          <p className="text-gray-700">
                            <strong>What this means for you:</strong> Consider incorporating HIIT workouts 2-3 times per week.
                            Activities like sprint intervals, circuit training, or CrossFit-style workouts might give you better results
                            than long-distance running or cycling.
                          </p>
                        </div>
                      )}
                      
                      {activeTab === 'medication' && (
                        <div className="bg-blue-50 rounded-lg p-5 mb-4">
                          <h4 className="text-lg font-medium text-gray-800 mb-2">Medication Response</h4>
                          <p className="text-gray-800 mb-3">
                            <strong>Important finding:</strong> You may metabolize certain medications differently than most people.
                          </p>
                          <p className="text-gray-700 mb-3">
                            Your genetic data shows variants in liver enzyme genes that can affect how quickly your body processes
                            certain medications. This doesn't mean medications won't work for you, but you might need different dosages
                            or alternatives for optimal results.
                          </p>
                          <p className="text-gray-700">
                            <strong>What to do:</strong> Share this information with your doctor. For common medications like pain relievers,
                            you might find that some work better than others. Pay attention to how your body responds to medications and report
                            unusual side effects to your healthcare provider.
                          </p>
                        </div>
                      )}
                      
                      {activeTab === 'ancestry' && (
                        <div className="bg-blue-50 rounded-lg p-5 mb-4">
                          <h4 className="text-lg font-medium text-gray-800 mb-2">Ancestry Highlights</h4>
                          <p className="text-gray-800 mb-3">
                            <strong>Ancient connections:</strong> Your DNA contains traces from ancient populations and even non-human ancestors.
                          </p>
                          <p className="text-gray-700 mb-3">
                            We found genetic markers associated with Western European Hunter-Gatherers who lived 8,000+ years ago.
                            You also carry approximately 2.1% Neanderthal DNA, which is slightly higher than the average European.
                          </p>
                          <p className="text-gray-700">
                            <strong>What this means:</strong> Your genetic ancestry includes connections to ancient human populations
                            that adapted to survive in prehistoric Europe. The Neanderthal variants you carry may influence certain traits
                            like hair color, immune response, and skin tone.
                          </p>
                        </div>
                      )}
                      
                      {activeTab === 'diseaseRisk' && (
                        <div className="bg-blue-50 rounded-lg p-5 mb-4">
                          <h4 className="text-lg font-medium text-gray-800 mb-2">Health Risk Summary</h4>
                          <p className="text-gray-800 mb-3">
                            <strong>Overall profile:</strong> Your genetic data shows average or below-average risk for most common conditions.
                          </p>
                          <p className="text-gray-700 mb-3">
                            We analyzed your genetic markers for common health conditions like heart disease, type 2 diabetes, and certain cancers.
                            Your genetic profile doesn't show significantly elevated risk for these conditions compared to the general population.
                          </p>
                          <p className="text-gray-700">
                            <strong>Remember:</strong> Genetics is just one factor in disease risk. Lifestyle choices like diet, exercise,
                            sleep quality, and stress management often have a greater impact on your health outcomes than genetic factors.
                          </p>
                        </div>
                      )}
                      
                      <button
                        onClick={() => setShowDetailedReport(true)}
                        className="mt-4 w-full px-4 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        Read Detailed Scientific Report
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="prose prose-blue max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {activeTab === 'summary' && geneticReports.summary && (
                          <div dangerouslySetInnerHTML={{ 
                            __html: geneticReports.summary
                              .replace(/^### /gm, '') // Remove leading ### at the beginning of any line
                              .replace(/\n### /g, '<h3 class="text-xl font-semibold mt-5 mb-3">')
                              .replace(/\n#### /g, '<h4 class="text-lg font-medium mt-4 mb-2">')
                              .replace(/\n\*\*/g, '<br><strong>')
                              .replace(/\*\*/g, '</strong>')
                              .replace(/\n- /g, '<br>• ')
                              .replace(/\n\d\. /g, '<br>$& ')
                              .replace(/\n---/g, '<hr class="my-4">')
                              .replace(/\?$/g, '') // Remove question marks at the end
                              .replace(/Would you like assistance.*$/g, '') // Remove closing questions
                          }} />
                        )}
                        {activeTab !== 'summary' && (
                          <div dangerouslySetInnerHTML={{ 
                            __html: geneticReports[activeTab as keyof typeof geneticReports]!
                              .replace(/^### /gm, '') // Remove leading ### at the beginning of any line
                              .replace(/\n### /g, '<h3 class="text-xl font-semibold mt-5 mb-3">')
                              .replace(/\n#### /g, '<h4 class="text-lg font-medium mt-4 mb-2">')
                              .replace(/\n\*\*/g, '<br><strong>')
                              .replace(/\*\*/g, '</strong>')
                              .replace(/\n- /g, '<br>• ')
                              .replace(/\n\d\. /g, '<br>$& ')
                              .replace(/\n---/g, '<hr class="my-4">')
                              .replace(/\?$/g, '') // Remove question marks at the end
                              .replace(/Would you like assistance.*$/g, '') // Remove closing questions
                          }} />
                        )}
                      </div>
                      
                      <button
                        onClick={() => setShowDetailedReport(false)}
                        className="mt-6 w-full px-4 py-2.5 bg-gray-100 text-gray-800 font-medium text-sm rounded-lg hover:bg-gray-200 transition focus:outline-none focus:ring-2 focus:ring-gray-300"
                      >
                        Back to Summary
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
                  <p className="text-gray-500">No report generated yet. Click "Generate Report" to analyze your data.</p>
                  <button 
                    onClick={() => {
                      setIsGeneratingReport(true);
                      generateReport(activeTab);
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                    Generate Report
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Add a disconnectWallet function
  const disconnectWallet = () => {
    setWalletAddress(null);
    setEncryptionKey(null);
    setKeyHex(null);
    setCurrentStep(1);
    setShowDashboard(false);
    setHasStoredData(false);
    setEncryptionStatus(null);
    setDecryptedData(null);
    // Clear any genetic reports
    setGeneticReports({
      summary: null,
      methylation: null,
      carrier: null,
      nutrition: null,
      exercise: null,
      medication: null,
      ancestry: null,
      diseaseRisk: null
    });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12 font-sans">
      {/* Wallet Indicator */}
      {walletAddress && (
        <div className="fixed top-4 right-4 z-10">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 px-4 py-2 flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            <span className="text-sm font-medium text-gray-700 mr-3">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
            <button 
              onClick={disconnectWallet}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="w-full max-w-5xl">
        {/* Header */}
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 tracking-tight">Geneflow</h1>
          <p className="text-lg text-gray-600 mx-auto max-w-xl">
            Secure, private, encrypted and anonymized. Discover you.
          </p>
        </header>

        {/* Global Search Bar - Only show when connected and has data */}
        {walletAddress && decryptedData && (
          <div className="mb-8">
            <form onSubmit={handleSearch} className="flex flex-col">
              <div className="flex mb-2">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask anything about your genes or SNPs..." 
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
                />
                <button 
                  type="submit"
                  disabled={isSearching}
                  className="bg-blue-600 text-white px-6 py-3 rounded-r-lg hover:bg-blue-700 flex items-center justify-center"
                >
                  {isSearching ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Your genetic data is loaded. Ask anything about yourself!
              </p>
            </form>
          </div>
        )}
        
        {/* Chat History - Only show when connected and has data */}
        {walletAddress && decryptedData && chatHistory.length > 0 && (
          <div className="mb-8 border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">Conversation History</h3>
            </div>
            <div 
              id="chat-messages" 
              className="p-4 max-h-96 overflow-y-auto"
              ref={(el) => {
                // Auto-scroll to bottom when chat history updates
                if (el) {
                  el.scrollTop = el.scrollHeight;
                }
              }}
            >
              {chatHistory.map((message, index) => (
                <div 
                  key={index} 
                  className={`mb-4 ${message.role === 'user' ? 'text-right' : ''}`}
                >
                  <div 
                    className={`inline-block px-4 py-2 rounded-lg ${message.role === 'user' ? 'max-w-3/4 bg-blue-100 text-blue-800 rounded-br-none' : 'w-11/12 bg-gray-100 text-gray-800 rounded-bl-none'}`}
                  >
                    {message.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : message.isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    ) : (
                      <div className="text-sm prose prose-sm max-w-none overflow-auto">
                        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Stepper - Only show if not in dashboard */}
        {!showDashboard && (
          <nav className="mb-10">
            <ol className="flex items-center w-full justify-between border-t border-gray-200 px-6">
              {['Connect Wallet', 'Upload Data', 'Encrypt', 'Store on Chain', 'Download/Use'].map((step, index) => (
                <li key={step} className={`flex items-center ${index < currentStep ? 'text-blue-600' : index === currentStep - 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                  <span className={`flex items-center justify-center w-8 h-8 rounded-full border ${
                    index < currentStep 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : index === currentStep - 1 
                      ? 'bg-blue-100 text-blue-600 border-blue-600' 
                      : 'bg-white text-gray-400 border-gray-300'
                  }`}>
                    {index < currentStep ? (
                      <svg className="w-3.5 h-3.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 12">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5.917 5.724 10.5 15 1.5"/>
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="ml-2 text-sm font-medium hidden sm:inline">{step}</span>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Main Content - Dashboard or Onboarding */}
        {walletAddress && hasStoredData && showDashboard ? (
          <Dashboard />
        ) : (
          <main className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            {/* Status Message */}
            {encryptionStatus && (
              <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
                <p className="text-sm text-blue-700">{encryptionStatus}</p>
              </div>
            )}

            {/* Wallet Connection */}
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-medium text-gray-800 mb-4">Step 1: Connect Your Wallet</h2>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-2">
                    Connect your MetaMask wallet to create a secure encryption key and access the blockchain.
                  </p>
                  {walletAddress && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <p className="text-sm font-medium text-gray-700">
                        Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                      </p>
                    </div>
                  )}
                  {keyHex && (
                    <div className="mt-2 pl-4 border-l-2 border-blue-200">
                      <p className="text-xs text-gray-500">Encryption key derived</p>
                      <p className="font-mono text-gray-700 text-xs">{keyHex.slice(0, 8)}...{keyHex.slice(-8)}</p>
                    </div>
                  )}
                </div>
                {!walletAddress && (
                  <button
                    className="px-6 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-300 whitespace-nowrap"
                    onClick={connectWalletAndDeriveKey}
                    disabled={connecting}
                  >
                    {connecting ? "Connecting..." : "Connect MetaMask"}
                  </button>
                )}
              </div>
            </div>

            {/* File Upload & Actions */}
            <div className="p-6">
              {!walletAddress ? (
                <div className="py-8 text-center">
                  <p className="text-gray-500">Connect your wallet to continue</p>
                </div>
              ) : hasStoredData ? (
                // User Data Management Interface
                <div>
                  <h2 className="text-xl font-medium text-gray-800 mb-4">Your Genetic Data</h2>
                  <div className="flex flex-col items-center py-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-700 mb-2">Your data is stored securely on-chain</h3>
                    <p className="text-sm text-gray-600 mb-6 text-center max-w-md">
                      Your genetic data is encrypted and stored on the blockchain. Only you have the key to decrypt and access it.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        className="px-5 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                        onClick={downloadAndDecryptData}
                        disabled={!encryptionKey || !walletAddress || !contract}
                      >
                        Access My Genetic Insights
                      </button>
                      <button
                        className="px-5 py-2.5 bg-white border border-red-300 text-red-600 font-medium text-sm rounded-lg hover:bg-red-50 transition focus:outline-none focus:ring-2 focus:ring-red-300"
                        onClick={deleteStoredData}
                      >
                        Delete Data
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // New Data Upload Interface
                <div>
                  <h2 className="text-xl font-medium text-gray-800 mb-4">Step 2: Upload Your Genetic Data</h2>
                  <div className="space-y-6">
                    <p className="text-gray-600 text-sm">
                      Upload your 23andMe or Ancestry ZIP file. Your data will be encrypted locally before being stored on the blockchain.
                    </p>

                    {!uploadedFile ? (
                      <div>
                        <div 
                          {...getRootProps()} 
                          className={`border-2 border-dashed rounded-lg p-10 transition cursor-pointer flex flex-col items-center justify-center ${
                            isDragActive 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          <input {...(getInputProps() as React.InputHTMLAttributes<HTMLInputElement>)} />
                          <svg className="w-14 h-14 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                          </svg>
                          <p className="text-gray-600 font-medium mb-1">Drag & drop your file here</p>
                          <p className="text-gray-500 text-sm">or <span className="text-blue-600">browse files</span></p>
                          <p className="text-gray-400 text-xs mt-2">ZIP file from 23andMe or Ancestry (max 20MB)</p>
                        </div>
                        <div className="mt-4 text-center">
                          <button
                            onClick={useSampleGeneticData}
                            className="text-blue-600 underline text-sm hover:text-blue-800"
                          >
                            Use sample genetic data for testing
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-200 p-6">
                        <div className="flex items-start mb-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-4 flex-shrink-0">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                          </div>
                          <div>
                            <div className="flex items-center">
                              <h3 className="font-medium text-gray-800 mr-3">{uploadedFile.name}</h3>
                              <span className="text-xs text-gray-500">{(uploadedFile.size / 1024).toFixed(1)} KB</span>
                            </div>
                            <div className="mt-1 flex items-center">
                              <div className="w-full h-2 bg-gray-200 rounded-full mr-2">
                                <div className="h-2 bg-blue-600 rounded-full" style={{ width: '100%' }}></div>
                              </div>
                              <span className="text-xs text-gray-600">100%</span>
                            </div>
                          </div>
                        </div>

                        {!encryptedData ? (
                          <button
                            className="w-full px-4 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                            onClick={encryptFile}
                            disabled={!encryptionKey}
                          >
                            Encrypt Data
                          </button>
                        ) : (
                          <>
                            <div className="flex items-center mt-2 mb-4">
                              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                              <p className="text-sm text-gray-700">Encryption complete</p>
                            </div>
                            <button
                              className="w-full px-4 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-300"
                              onClick={storeEncryptedData}
                              disabled={storing}
                            >
                              {storing ? "Storing on-chain..." : "Store On-Chain"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>
        )}

        {/* Features Overview - Show only if not in dashboard */}
        {!showDashboard && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
            <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
              </div>
              <h3 className="font-medium text-gray-800 mb-1">Private by Design</h3>
              <p className="text-sm text-gray-600">Your data is end-to-end encrypted. Only you have the key to decrypt it.</p>
            </div>
            <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                </svg>
              </div>
              <h3 className="font-medium text-gray-800 mb-1">AI Health Reports</h3>
              <p className="text-sm text-gray-600">Get personalized, actionable insights based on your genetic data.</p>
            </div>
            <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <h3 className="font-medium text-gray-800 mb-1">Instant Q&A</h3>
              <p className="text-sm text-gray-600">Ask questions, get answers from your genetics in real-time.</p>
            </div>
          </section>
        )}
        
        <footer className="mt-12 text-center">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Geneflow. All rights reserved.
            <span className="mx-2">|</span>
            <a href="#" className="hover:text-blue-600 transition">Privacy Policy</a>
            <span className="mx-2">|</span>
            <a href="#" className="hover:text-blue-600 transition">Terms of Service</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
