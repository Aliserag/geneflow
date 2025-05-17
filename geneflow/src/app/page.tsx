import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 dark:from-gray-900 dark:via-gray-950 dark:to-blue-900 flex flex-col items-center justify-center px-4 py-12">
      <header className="w-full max-w-4xl flex flex-col items-center gap-4 mb-12">
        <Image src="/favicon.ico" alt="GeneFlow Logo" width={64} height={64} className="rounded-xl shadow-lg" />
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-purple-600 dark:from-blue-300 dark:to-purple-400 text-center">Geneflow: Discover You</h1>
        <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-200 text-center max-w-2xl">
          Web3-powered genetic analysis. Upload your raw SNP data, get personalized, actionable reports, and control your privacy with blockchain technology.
        </p>
      </header>
      <main className="w-full max-w-2xl flex flex-col items-center gap-8">
        {/* Upload SNP File CTA */}
        <div className="w-full bg-white/80 dark:bg-gray-900/80 rounded-2xl shadow-xl p-8 flex flex-col items-center gap-4 border border-blue-100 dark:border-blue-900">
          <h2 className="text-2xl font-semibold mb-2 text-blue-700 dark:text-blue-300">Upload Your SNP Data</h2>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-4">Securely upload your 23andMe or Ancestry raw data (ZIP file). All data is encrypted and stored on-chain for your privacy.</p>
          <button className="bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-700 hover:to-purple-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all text-lg">Upload SNP File</button>
        </div>
        {/* Features Overview */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mt-8">
          <FeatureCard title="Blockchain Privacy" icon="🔒" desc="Your genetic data is encrypted and stored on the Flow blockchain. Only you control access." />
          <FeatureCard title="LLM-Powered Reports" icon="🧬" desc="Get actionable, personalized genetic insights powered by advanced AI and DeepSeek." />
          <FeatureCard title="Secure Sharing" icon="🤝" desc="Share your reports with doctors or family securely, with full permission control." />
          <FeatureCard title="Instant Answers" icon="⚡" desc="Ask any genetic question and get real-time, LLM-powered responses from your data." />
        </section>
      </main>
      <footer className="mt-16 text-gray-400 text-sm text-center">
        &copy; {new Date().getFullYear()} GeneFlow. All rights reserved.
      </footer>
    </div>
  );
}

function FeatureCard({ title, icon, desc }: { title: string; icon: string; desc: string }) {
  return (
    <div className="flex flex-col items-center bg-white/70 dark:bg-gray-800/70 rounded-xl p-6 shadow-md border border-gray-100 dark:border-gray-800">
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-semibold text-lg mb-1 text-blue-700 dark:text-blue-300">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300 text-center text-sm">{desc}</p>
    </div>
  );
}
