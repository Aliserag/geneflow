/**
 * Utility to generate sample genetic data for testing
 */

/**
 * Generate a sample 23andMe format genetic data string
 */
export function generateSample23andMeData(snpCount: number = 100): string {
  // Header for 23andMe format
  let output = '# This data file generated by 23andMe\n';
  output += '# rsid\tchromosome\tposition\tgenotype\n';
  
  // Common SNPs for testing
  const commonSnps = [
    { rsid: 'rs1801133', chromosome: '1', position: '11856378', genotypes: ['GG', 'AG', 'AA'] },
    { rsid: 'rs1801131', chromosome: '1', position: '11854476', genotypes: ['TT', 'GT', 'GG'] },
    { rsid: 'rs234706', chromosome: '21', position: '44483184', genotypes: ['AA', 'AG', 'GG'] },
    { rsid: 'rs1805087', chromosome: '1', position: '237048500', genotypes: ['AA', 'AG', 'GG'] },
    { rsid: 'rs4988235', chromosome: '2', position: '136608646', genotypes: ['GG', 'AG', 'AA'] },
    { rsid: 'rs429358', chromosome: '19', position: '45411941', genotypes: ['TT', 'CT', 'CC'] },
    { rsid: 'rs7412', chromosome: '19', position: '45412079', genotypes: ['CC', 'CT', 'TT'] },
    { rsid: 'rs1799983', chromosome: '7', position: '150696111', genotypes: ['GG', 'GT', 'TT'] },
    { rsid: 'rs1801282', chromosome: '3', position: '12393125', genotypes: ['CC', 'CG', 'GG'] },
    { rsid: 'rs1815739', chromosome: '11', position: '66560624', genotypes: ['CC', 'CT', 'TT'] },
  ];
  
  // Add the common SNPs first
  for (const snp of commonSnps) {
    // Randomly select a genotype
    const genotype = snp.genotypes[Math.floor(Math.random() * snp.genotypes.length)];
    output += `${snp.rsid}\t${snp.chromosome}\t${snp.position}\t${genotype}\n`;
  }
  
  // Generate random SNPs for the remaining count
  const remainingCount = Math.max(0, snpCount - commonSnps.length);
  for (let i = 0; i < remainingCount; i++) {
    const rsid = `rs${10000000 + i}`;
    const chromosome = Math.floor(Math.random() * 22) + 1;
    const position = Math.floor(Math.random() * 100000000) + 1;
    
    // Random genotype (AA, AG, GG, CC, CT, TT, etc.)
    const bases = ['A', 'C', 'G', 'T'];
    const base1 = bases[Math.floor(Math.random() * bases.length)];
    const base2 = bases[Math.floor(Math.random() * bases.length)];
    const genotype = base1 + base2;
    
    output += `${rsid}\t${chromosome}\t${position}\t${genotype}\n`;
  }
  
  return output;
}

/**
 * Convert a string to ArrayBuffer
 */
export function stringToArrayBuffer(str: string): ArrayBufferLike {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
}

/**
 * Create a sample genetic data file
 */
export function createSampleGeneticDataFile(): File {
  const sampleData = generateSample23andMeData(200); // 200 SNPs
  const blob = new Blob([sampleData], { type: 'text/plain' });
  return new File([blob], 'sample_genetic_data.txt', { type: 'text/plain' });
} 