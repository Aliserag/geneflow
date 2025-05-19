# GeneFlow: Own Your Genetic Data

<div align="center">
  <p><strong>Click Image Below to Watch Project Video</strong></p>
</div>


<div align="center">
  <a href="https://www.youtube.com/watch?v=UCNFwJwMuYw">
    <img src="https://img.youtube.com/vi/UCNFwJwMuYw/0.jpg" alt="GeneFlow Demo" />
  </a>
</div>


<div align="center">
  <p><strong>Secure. Private. Encrypted. Anonymized. Discover you.</strong></p>
</div>


[Live Demo](geneflow.vercel.app)

## 🧬 GeneFlow - Discover the Universe Within You

GeneFlow is a Web3-powered genetic analysis platform that gives you complete ownership and control over your genetic data. Using client-side encryption with keys derived from your MetaMask wallet, GeneFlow ensures that only you can decrypt and access your genetic information.

In a world where genetic testing companies regularly sell user data, suffer security breaches, and file for bankruptcy—putting millions of genetic profiles at risk—GeneFlow offers a revolutionary alternative.

## 🛡️ Why Web3?

- **True Data Ownership**: Your genetic data belongs to you alone, not corporations
- **End-to-End Encryption**: Data is encrypted client-side using your wallet as the key
- **Blockchain Security**: Encrypted data stored on Flow blockchain for immutability 
- **No Central Database**: Your data never sits in a corporate server vulnerable to hacks
- **Personalized Insights**: Receive detailed reports on health, ancestry, nutrition, and more
- **Interactive Chat**: Ask questions about your genes and receive instant, personalized answers

## ✨ Features

- **Multiple Report Categories**:
  - Comprehensive Summary
  - Methylation Analysis
  - Carrier Status
  - Nutrition Insights
  - Exercise Recommendations
  - Medication Response
  - Ancestry Composition
  - Disease Risk Assessment

  These would normally cost you ~$5,000+. WIth GeneFlow, you access them and so much more, for FREE.

- **Interactive Chat Interface**: Ask specific questions about your genetic data
- **Secure Encryption**: MetaMask-based key derivation f
- **Easy Data Management**: Upload, encrypt, store, and access your data
- **User-Friendly Design**: Clean, intuitive interface with step-by-step guidance

## Post Hackathon todos:
 - Integrate account linking for couples interested in prenatal gene testing as well as for giving temporarily/secure access to healthcare providers.
 - Implement sustainable 'lossless' business model such as a protocol token staking contract that allows users access to the app after staking x tokens, with rewards going to the protocol. Users can unstake at any time.


## 🚀 Getting Started

### Prerequisites

- [MetaMask](https://metamask.io/download/) browser extension
- [Node.js](https://nodejs.org/) (v18 or higher)
- A 23andMe or Ancestry.com genetic data file (or use our test file)

### Installation

1. Clone the repository:

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Testing Without Your Own Genetic Data

For testing purposes, you can use the sample genetic data file included in this repository:

1. Download `geneflow_data_testing_23andMe_format.zip` from the repository
2. Follow the app's step-by-step process to connect your wallet
3. Upload the test file when prompted
4. Explore the reports and chat functionality

This test file contains a subset of real 23andMe data format (anonymized) so you can experience the full functionality of the platform.

## Why I built Geneflow

Throughout their history, companies like 23andMe have regularly sold users' data, and in early 2023, 7 million users had their data breached when hackers exploited leaked passwords. The data was just sitting there, unprotected and out of users' control.

The creator of GeneFlow was one of these victims. After downloading their genetic data and deactivating their 23andMe account, they integrated their genetic data with an AI chatbot for personal insights. This exploration revealed a genetic variant (MTHFR) affecting folate metabolism, explaining years of persistent low energy and brain fog—symptoms that doctors had consistently overlooked.

After taking methylated folate supplements based on this discovery, they experienced a dramatic improvement in energy, focus, and overall well-being. This life-changing revelation demonstrated the immense value hidden within our genetic data—and the importance of having private, secure access to it.

GeneFlow was built to make these insights accessible to everyone while ensuring their genetic data remains firmly in their control.

## 💡 Technical Details

- **Front-end**: Next.js, React, TypeScript, TailwindCSS
- **Contract**: Solidity, hardhat
- **Encryption**: AES-GCM with MetaMask-derived keys
- **Data Analysis**: LLM for personalized genetic interpretation
- **File Handling**: Support for 23andMe and Ancestry.com file formats (also made it more robust to accept txt files as well as zip)

## 🔗 Impact

The genetic testing market exceeds $21 billion and is relevant to everyone, but is dominated by companies that take your data without your control. GeneFlow is different:

**Your data. Your insights. Your rules.**

---

Within your genes lies a universe. Only you should own it. GeneFlow makes that possible.
