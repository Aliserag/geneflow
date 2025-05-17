"use client";

import Image from "next/image";
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
    setEncryptionStatus("Encrypting...");
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
      setEncryptionStatus("Encrypted and ready for on-chain storage.");
    } catch (error) {
      console.error("Encryption error:", error);
      setEncryptionStatus("Encryption failed");
    }
  };

  // Store encrypted data on-chain
  const storeEncryptedData = async () => {
    if (!encryptedData || !contract) return;
    setStoring(true);
    try {
      setEncryptionStatus("Storing on-chain...");
      const tx = await contract.storeData(encryptedData);
      await tx.wait();
      setEncryptionStatus("Data stored successfully on-chain!");
      setHasStoredData(true);
    } catch (error) {
      console.error("Storage error:", error);
      setEncryptionStatus("Failed to store data on-chain");
    }
    setStoring(false);
  };

  // Delete stored data
  const deleteStoredData = async () => {
    if (!contract) return;
    try {
      setEncryptionStatus("Deleting stored data...");
      const tx = await contract.deleteData();
      await tx.wait();
      setEncryptionStatus("Data deleted successfully!");
      setHasStoredData(false);
      setEncryptedData(null);
    } catch (error) {
      console.error("Deletion error:", error);
      setEncryptionStatus("Failed to delete data");
    }
  };

  return (
    <div className="min-h-screen bg-neutral flex flex-col items-center justify-center px-4 py-12">
      <header className="w-full max-w-2xl flex flex-col items-center gap-2 mb-10">
        <Image src="/favicon.ico" alt="GeneFlow Logo" width={48} height={48} className="rounded-lg mb-2" />
        <h1 className="text-3xl sm:text-4xl font-bold text-primary-dark text-center tracking-tight">Geneflow: Discover You</h1>
        <p className="text-base sm:text-lg text-neutral-mid text-center max-w-xl mt-2">
          Secure, AI-powered genetic insights. Upload your raw SNP data and unlock actionable, private health reports.
        </p>
        <div className="mt-4 flex flex-col items-center gap-2">
          {walletAddress ? (
            <div className="text-xs text-primary-dark bg-neutral rounded px-3 py-1 border border-primary-light">Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</div>
          ) : (
            <button
              className="bg-primary text-white font-medium py-2 px-6 rounded-lg transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-offset-2"
              onClick={connectWalletAndDeriveKey}
              disabled={connecting}
            >
              {connecting ? "Connecting..." : "Connect MetaMask"}
            </button>
          )}
          {keyHex && (
            <div className="text-xs text-neutral-mid mt-1">Encryption Key: <span className="font-mono">{keyHex.slice(0, 8)}...{keyHex.slice(-8)}</span></div>
          )}
        </div>
      </header>
      <main className="w-full max-w-md flex flex-col items-center gap-8">
        {/* Upload SNP File CTA */}
        <div className="w-full bg-white dark:bg-neutral-dark rounded-xl border border-neutral-mid/10 p-6 flex flex-col items-center gap-3">
          <h2 className="text-lg font-semibold text-primary-dark mb-1">Upload Your SNP Data</h2>
          <p className="text-neutral-mid text-center text-sm mb-2">Upload your 23andMe or Ancestry ZIP file. Your data is encrypted and only you control access.</p>
          {hasStoredData ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-primary-dark">You already have data stored on-chain.</p>
              <button
                className="mt-2 bg-red-500 text-white font-medium py-1.5 px-4 rounded-lg transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
                onClick={deleteStoredData}
              >
                Delete Stored Data
              </button>
            </div>
          ) : (
            <div {...getRootProps()} className={`w-full max-w-xs flex flex-col items-center justify-center border-2 border-dashed rounded-lg px-4 py-8 cursor-pointer transition bg-neutral hover:bg-neutral/70 focus:outline-none focus:ring-2 focus:ring-primary-light ${isDragActive ? 'border-primary bg-primary/10' : 'border-neutral-mid/30'}`} tabIndex={0} aria-label="File Upload Dropzone">
              <input {...(getInputProps() as React.InputHTMLAttributes<HTMLInputElement>)} />
              {uploadedFile ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-primary-dark font-medium text-sm">{uploadedFile.name}</span>
                  <span className="text-xs text-neutral-mid">{(uploadedFile.size / 1024).toFixed(1)} KB</span>
                  {!encryptedData ? (
                    <button
                      className="mt-2 bg-accent text-white font-medium py-1.5 px-4 rounded-lg transition hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent-light focus:ring-offset-2"
                      onClick={encryptFile}
                      disabled={!encryptionKey}
                    >
                      Encrypt Data
                    </button>
                  ) : (
                    <button
                      className="mt-2 bg-primary text-white font-medium py-1.5 px-4 rounded-lg transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-offset-2"
                      onClick={storeEncryptedData}
                      disabled={storing}
                    >
                      {storing ? "Storing..." : "Store On-Chain"}
                    </button>
                  )}
                  {encryptionStatus && (
                    <span className="text-xs text-neutral-mid mt-1">{encryptionStatus}</span>
                  )}
                  {encryptedData && (
                    <span className="text-xs font-mono text-primary-dark mt-1">Encrypted: {Array.from(encryptedData.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ')}...</span>
                  )}
                </div>
              ) : (
                <>
                  <span className="text-2xl mb-2" aria-hidden>📁</span>
                  <span className="text-sm text-neutral-mid text-center">Drag & drop your .zip file here, or click to select</span>
                </>
              )}
            </div>
          )}
        </div>
        {/* Features Overview */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-6">
          <FeatureCard title="Private by Design" icon="🔒" desc="End-to-end encryption. Only you can access your data." />
          <FeatureCard title="AI Health Reports" icon="🧬" desc="Personalized, actionable insights powered by LLMs." />
          <FeatureCard title="Share Securely" icon="🤝" desc="Permissioned sharing with doctors or family." />
          <FeatureCard title="Instant Q&A" icon="💡" desc="Ask questions, get answers from your genetics." />
        </section>
      </main>
      <footer className="mt-12 text-neutral-mid text-xs text-center">
        &copy; {new Date().getFullYear()} Geneflow. All rights reserved.
      </footer>
    </div>
  );
}

function FeatureCard({ title, icon, desc }: { title: string; icon: string; desc: string }) {
  return (
    <div className="flex flex-col items-center bg-neutral rounded-lg p-4 border border-neutral-mid/10">
      <div className="text-xl mb-1" aria-hidden>{icon}</div>
      <h3 className="font-medium text-sm text-primary-dark mb-0.5 text-center">{title}</h3>
      <p className="text-xs text-neutral-mid text-center leading-snug">{desc}</p>
    </div>
  );
}
