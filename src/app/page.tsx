"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ethers } from "ethers";
import contractInfo from "../contracts/GeneFlowEncryptedData.json";

function toHexString(byteArray: Uint8Array) {
  return Array.from(byteArray, (byte) => {
    return ("0" + (byte & 0xff).toString(16)).slice(-2);
  }).join("");
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

  // MetaMask connect and key derivation
  const connectWalletAndDeriveKey = async () => {
    setConnecting(true);
    try {
      if (!window.ethereum) {
        alert("MetaMask is not installed");
        setConnecting(false);
        return;
      }
      const provider = new ethers.BrowserProvider(window.ethereum as unknown as ethers.Eip1193Provider);
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];
      setWalletAddress(address);
      const signer = await provider.getSigner();
      
      // Initialize contract
      const geneFlowContract = new ethers.Contract(
        contractInfo.address,
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
      alert("MetaMask connection failed");
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
    accept: { 'application/zip': ['.zip'] },
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

      // Check if on Flow testnet (chain ID 545)
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      console.log("Current chain ID:", chainId);
      if (chainId !== '0x221') { // 0x221 is hex for 545
        setEncryptionStatus("Please switch to Flow testnet (Chain ID: 545) in MetaMask");
        setStoring(false);
        return;
      }
      
      console.log("Requesting transaction from MetaMask...");
      setEncryptionStatus("Requesting transaction from MetaMask. Please check your wallet popup...");
      
      // Get current account
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const from = accounts[0];
      
      // Encode the function call using ethers
      const ABI = ["function storeData(bytes data)"];
      const contractInterface = new ethers.Interface(ABI);
      const data = contractInterface.encodeFunctionData("storeData", [encryptedData]);
      
      // Prepare transaction parameters
      const txParams = {
        from: from,
        to: contractInfo.address,
        data: data,
        gas: ethers.toBeHex(3000000), // Set a high gas limit to ensure it's not the issue
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
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || "https://testnet.evm.nodes.onflow.org");
      const receipt = await provider.waitForTransaction(txHash);
      
      console.log("Transaction confirmed:", receipt);
      setEncryptionStatus("Success! Your data is now securely stored on the blockchain.");
      setHasStoredData(true);
      setCurrentStep(5);
    } catch (error) {
      console.error("Storage error:", error);
      if ((error as any)?.code === 4001) {
        // MetaMask error code for user rejected transaction
        setEncryptionStatus("Transaction rejected. You declined the MetaMask request.");
      } else if ((error as any)?.code === -32002) {
        // MetaMask error code for request already pending
        setEncryptionStatus("A MetaMask request is already pending. Please check your MetaMask extension.");
      } else if ((error as any)?.message?.includes("user rejected")) {
        setEncryptionStatus("Transaction rejected. You declined the MetaMask request.");
      } else {
        setEncryptionStatus(`Failed to store data: ${(error as Error).message || "Unknown error"}`);
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
      const encryptedBytes: Uint8Array = await contract.getData(walletAddress);
      if (!encryptedBytes || encryptedBytes.length === 0) {
        setEncryptionStatus("No data found on-chain.");
        return;
      }
      setEncryptionStatus("Decrypting your data...");
      const iv = encryptedBytes.slice(0, 12); // 96-bit IV
      const ciphertext = encryptedBytes.slice(12);
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        encryptionKey,
        ciphertext
      );
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
    } catch (error) {
      console.error("Decryption error:", error);
      setEncryptionStatus("Failed to decrypt or download data. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12 font-sans">
      {/* Main Container */}
      <div className="w-full max-w-3xl">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 tracking-tight">Geneflow</h1>
          <p className="text-lg text-gray-600 mx-auto max-w-xl">
            Secure, private genetic data platform with end-to-end encryption
          </p>
        </header>

        {/* Progress Stepper */}
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

        {/* Main Content */}
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
                      Download & Decrypt
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                      <p className="text-gray-600 font-medium mb-1">Drag & drop your file here</p>
                      <p className="text-gray-500 text-sm">or <span className="text-blue-600">browse files</span></p>
                      <p className="text-gray-400 text-xs mt-2">ZIP file from 23andMe or Ancestry (max 20MB)</p>
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

        {/* Features Overview */}
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
