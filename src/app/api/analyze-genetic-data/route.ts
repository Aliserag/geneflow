import { NextRequest, NextResponse } from 'next/server';
import { extractSNPs, getSignificantSNPs, formatSNPsForPrompt } from '../../../utils/snpParser';
import JSZip from 'jszip';

// Define the DeepSeek API URL
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log('API route called with method:', request.method);
    
    // Parse the incoming form data
    const formData = await request.formData();
    const reportType = formData.get('report_type') as string;
    const query = formData.get('query') as string;
    
    // Get custom parameters if they exist
    const customPrompt = formData.get('custom_prompt') as string;
    const customInstructions = formData.get('custom_instructions') as string;
    const responseType = formData.get('response_type') as string;
    
    console.log(`Debug - API Key exists: ${!!DEEPSEEK_API_KEY}`);
    console.log(`Debug - Report Type: ${reportType}`);
    console.log(`Debug - Query: ${query}`);
    console.log(`Debug - Custom Prompt: ${!!customPrompt}`);
    console.log(`Debug - Custom Instructions: ${!!customInstructions}`);
    console.log(`Debug - Response Type: ${responseType}`);
    
    // Get the genetic data file if it exists
    const geneticDataFile = formData.get('genetic_data') as File | null;
    console.log(`Debug - Genetic Data File: ${!!geneticDataFile}, ${geneticDataFile?.name}, ${geneticDataFile?.size} bytes, ${geneticDataFile?.type}`);
    
    let geneticDataText = '';
    
    // If no genetic data or query is provided, return an error
    if (!geneticDataFile && !query) {
      console.error('No genetic data or query provided');
      return NextResponse.json(
        { 
          success: false, 
          error: 'No genetic data or query provided'
        },
        { status: 400 }
      );
    }
    
    if (geneticDataFile) {
      try {
        // Read the data file
        const arrayBuffer = await geneticDataFile.arrayBuffer();
        
        // Check if it's a ZIP file by looking at the first bytes (PK header)
        const isZipFile = new Uint8Array(arrayBuffer.slice(0, 2)).every((byte, i) => [0x50, 0x4B][i] === byte);
        console.log(`Debug - File appears to be a ZIP: ${isZipFile}`);
        
        if (isZipFile) {
          try {
            console.log('Attempting to extract contents from ZIP file');
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(arrayBuffer);
            
            // Look for genetic data files in the ZIP
            let geneticFileFound = false;
            
            // Define patterns for genetic data files
            const geneticFilePatterns = [
                /genome.*\.txt$/i,
                /dna.*\.txt$/i,
                /genetic.*\.txt$/i,
                /ancestry.*\.txt$/i,
                /23andme.*\.txt$/i,
                /.*_raw_data.*\.txt$/i
            ];
            
            // Process zip files
            for (const fileName in zipContent.files) {
              const file = zipContent.files[fileName];
              
              // Skip directories
              if (file.dir) continue;
              
              console.log(`Found file in ZIP: ${fileName}`);
              
              // Check if this looks like genetic data
              const isGeneticFile = geneticFilePatterns.some(pattern => pattern.test(fileName));
              
              if (isGeneticFile || fileName.endsWith('.txt')) {
                console.log(`Extracting genetic data from: ${fileName}`);
                const content = await file.async('text');
                
                // Check for genetic markers in the content
                if (content.includes('rs') || /rs\d+/.test(content)) {
                  geneticDataText = content;
                  geneticFileFound = true;
                  console.log(`Genetic data found in ${fileName}, length: ${content.length} chars`);
                  break;
                }
              }
            }
            
            if (!geneticFileFound) {
              console.log('No genetic data files found in ZIP');
              return NextResponse.json({
                success: true,
                analysis: `No genetic data files found in the uploaded ZIP. Please ensure your ZIP contains a 23andMe or Ancestry text file.`,
                noData: true
              });
            }
          } catch (zipError) {
            console.error('Error extracting ZIP file:', zipError);
            return NextResponse.json({
              success: false,
              error: `Could not extract the ZIP file: ${zipError instanceof Error ? zipError.message : 'Unknown error'}`
            }, { status: 400 });
          }
        } else {
          // Assume it's a text file
          geneticDataText = new TextDecoder().decode(arrayBuffer);
        }
        
        console.log(`Debug - Genetic data length: ${geneticDataText.length} characters`);
        console.log(`Debug - Data preview: ${geneticDataText.substring(0, 100)}...`);
        
        // Process genetic data using our utility
        const allSnps = extractSNPs(geneticDataText);
        console.log(`Debug - Extracted SNPs count: ${allSnps.length}`);
        
        // If no SNPs were extracted, generate a fallback response
        if (allSnps.length === 0) {
          return NextResponse.json({
            success: true,
            analysis: `No SNPs could be extracted from the provided data. Please ensure you're uploading a valid genetic data file in 23andMe or Ancestry format.`,
            noSnps: true
          });
        }
        
        // Get significant SNPs for the report type if specified
        const relevantSnps = reportType 
          ? getSignificantSNPs(allSnps, reportType) 
          : allSnps.slice(0, 50); // Limit to 50 SNPs if no specific type
        
        console.log(`Debug - Relevant SNPs count: ${relevantSnps.length}`);
        
        // Format SNPs for the prompt
        const snpText = formatSNPsForPrompt(relevantSnps);
        
        // Generate the appropriate specialized prompt based on report type
        let { prompt, userQuery } = generateSpecializedPrompt(reportType, allSnps, relevantSnps, snpText);
        
        // Override with custom prompt if provided
        if (customPrompt) {
          console.log('Using custom prompt from request');
          prompt = `You are a genetic analysis specialist interpreting SNP data.
          
          USER'S GENETIC PROFILE:
          - Total SNPs in dataset: ${allSnps.length}
          - Relevant SNPs identified: ${relevantSnps.length}
          
          KEY GENETIC MARKERS:
          ${snpText}
          
          ${customPrompt}`;
        }
        
        // Apply custom instructions if present and response type is direct_answer
        if (responseType === 'direct_answer' || customInstructions) {
          console.log('Applying direct answer format to prompt');
          prompt = `${prompt}
          
          DIRECT ANSWER REQUIREMENTS:
          - Provide a brief, conversational response (2-3 sentences when possible)
          - Skip the formal report structure and markdown formatting
          - Use plain language without technical jargon unless specifically needed
          - Get straight to the point with the most relevant information
          - Focus only on answering what was asked without additional details
          ${customInstructions || ''}`;
          
          // Modify user query to request direct answer
          userQuery = `Give me a direct, brief answer to this question: ${query || userQuery}`;
        }
        
        // Replace the existing systemPrompt with prompt and userMessage with userQuery
        const systemPrompt = prompt;
        const userMessage = query || userQuery || `Generate a comprehensive ${reportType} analysis based on my genetic data.`;
        
        try {
          // Check if API key is available
          if (!DEEPSEEK_API_KEY) {
            console.error('DEEPSEEK_API_KEY not provided in environment variables');
            return NextResponse.json({
              success: true,
              analysis: `[Testing Mode] DeepSeek API key not found in environment variables. This is a placeholder response for a ${reportType} report. In production, this would contain a detailed analysis of your ${relevantSnps.length} relevant genetic markers.`,
              testing: true
            });
          }
          
          // Call DeepSeek API with the genetic data context
          console.log('Calling DeepSeek API...');
          const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                {
                  role: 'system',
                  content: systemPrompt
                },
                {
                  role: 'user',
                  content: userMessage
                }
              ],
              temperature: 0.7,
              max_tokens: 1000
            })
          });
          
          if (!response.ok) {
            console.error(`DeepSeek API HTTP error: ${response.status}`);
            throw new Error(`LLM API connection error (${response.status}). Please verify your API key and try again.`);
          }
          
          const data = await response.json();
          console.log('DeepSeek API response received');
          
          if (data.error) {
            console.error(`DeepSeek API error: ${JSON.stringify(data.error)}`);
            throw new Error(`LLM API error: ${data.error.message || 'Unknown error occurred'}`);
          }
          
          return NextResponse.json({
            success: true,
            analysis: data.choices[0].message.content
          });
        } catch (error) {
          console.error('Error calling DeepSeek API:', error);
          
          // Provide a fallback response for testing without API
          return NextResponse.json({
            success: true,
            analysis: `[API Error] There was an issue connecting to the DeepSeek API. This is a placeholder response for a ${reportType} report. In production, this would contain a detailed analysis of your ${relevantSnps.length} relevant genetic markers.`,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } catch (error) {
        console.error('Error processing genetic data:', error);
        return NextResponse.json(
          { 
            success: false, 
            error: `Error processing genetic data: ${error instanceof Error ? error.message : 'Unknown error'}`
          },
          { status: 500 }
        );
      }
    } else if (query) {
      // If just a query without genetic data, provide a general response
      try {
        // Check if API key is available
        if (!DEEPSEEK_API_KEY) {
          console.error('DEEPSEEK_API_KEY not provided in environment variables');
          return NextResponse.json({
            success: true,
            analysis: `[Testing Mode] DeepSeek API key not found in environment variables. This is a placeholder response for your query: "${query}"`,
            testing: true
          });
        }
        
        const response = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: 'You are a genetic analysis assistant. The user is asking questions about genetic data, but no genetic data has been provided. Give a general response about the genetic concept they are asking about.'
              },
              {
                role: 'user',
                content: query
              }
            ],
            temperature: 0.7,
            max_tokens: 700
          })
        });
        
        if (!response.ok) {
          console.error(`DeepSeek API HTTP error: ${response.status}`);
          throw new Error(`LLM API connection error (${response.status}). Please verify your API key and try again.`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          console.error(`DeepSeek API error: ${JSON.stringify(data.error)}`);
          throw new Error(`LLM API error: ${data.error.message || 'Unknown error occurred'}`);
        }
        
        return NextResponse.json({
          success: true,
          analysis: data.choices[0].message.content,
          isGeneral: true
        });
      } catch (error) {
        console.error('Error in query-only response:', error);
        
        // Provide a fallback response for testing without API
        return NextResponse.json({
          success: true,
          analysis: `[API Error] There was an issue connecting to the DeepSeek API. This is a placeholder response for your query: "${query}"`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      throw new Error('No genetic data or query provided');
    }
  } catch (error) {
    console.error('Error in analyze-genetic-data route:', error);
    
    // Provide more detailed error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

// For genetic data search queries
export async function GET(request: NextRequest) {
  try {
    // Get the search query from URL
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const responseType = searchParams.get('response_type');
    
    if (!query) {
      throw new Error('No search query provided');
    }
    
    console.log(`Debug - Search query: ${query}`);
    console.log(`Debug - Response type: ${responseType}`);
    
    // Check if API key is available
    if (!DEEPSEEK_API_KEY) {
      console.error('DEEPSEEK_API_KEY not provided in environment variables');
      return NextResponse.json({
        success: true,
        answer: `[Testing Mode] DeepSeek API key not found in environment variables. This is a placeholder response for your search: "${query}"`,
        testing: true
      });
    }
    
    try {
      // Create system prompt based on response type
      let systemPrompt = 'You are a genetic information assistant. Provide concise, accurate information about genetic concepts, SNPs, and genetic health topics.';
      let userPrompt = query;
      
      // Modify prompts for direct answers
      if (responseType === 'direct_answer') {
        systemPrompt = `You are a genetic information assistant. Provide direct, brief answers using plain language. 
        Focus only on answering the question without additional context or explanations unless necessary.
        Avoid using technical jargon and formal report structures.`;
        
        userPrompt = `Give me a direct, brief answer to this question: ${query}`;
      }
      
      // Call DeepSeek API for genetic information
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.5,
          max_tokens: 500
        })
      });
      
      if (!response.ok) {
        console.error(`DeepSeek API HTTP error: ${response.status}`);
        throw new Error(`LLM API connection error (${response.status}). Please verify your API key and try again.`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.error(`DeepSeek API error: ${JSON.stringify(data.error)}`);
        throw new Error(`LLM API error: ${data.error.message || 'Unknown error occurred'}`);
      }
      
      return NextResponse.json({
        success: true,
        answer: data.choices[0].message.content
      });
    } catch (error) {
      console.error('Error calling DeepSeek API for search:', error);
      
      // Provide a fallback response for testing without API
      return NextResponse.json({
        success: true,
        answer: `[API Error] There was an issue connecting to the DeepSeek API. This is a placeholder response for your search: "${query}"`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in genetic search:', error);
    
    // Provide more detailed error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Generate specialized prompts for each report type
 */
function generateSpecializedPrompt(
  reportType: string | null,
  allSnps: any[],
  relevantSnps: any[],
  snpText: string
): { prompt: string; userQuery: string } {
  // Shared metadata section for all prompts
  const metadataSection = `
USER'S GENETIC PROFILE:
- Total SNPs in dataset: ${allSnps.length}
- Relevant SNPs identified: ${relevantSnps.length}
`;

  const sharedGuidelines = `
RESPONSE FORMAT REQUIREMENTS:
- Use markdown formatting (### for main headings, #### for subheadings)
- Structure information hierarchically with clear sections
- Use bullet points (- ) for lists
- Highlight key findings with **bold text**
- Separate major sections with horizontal rules (---)
- Include scientific context for each finding
- End with a concise conclusion WITHOUT questions

OUTPUT STYLE:
- Be scientifically accurate but accessible
- Focus on actionable insights
- Clearly indicate confidence levels
- Mention known limitations of the analysis
- Avoid deterministic statements about genetic predispositions
`;

  // Base prompt that will be customized
  let specializedPrompt = `You are a genetic analysis specialist interpreting SNP data.`;
  let specializedUserQuery = '';

  switch (reportType) {
    case 'summary':
      specializedPrompt += `${metadataSection}
TASK: Create a comprehensive summary of the user's genetic profile, highlighting the most significant findings across all major categories.

KEY MARKERS TO ANALYZE:
${snpText}

ANALYSIS REQUIREMENTS:
- Provide a holistic overview of the genetic data
- Organize findings by health importance and actionability
- Highlight 3-5 most significant/actionable genetic insights
- Include brief implications for health, nutrition, and medication response
- Summarize ancestry information if relevant markers are present

SPECIFIC SECTIONS TO INCLUDE:
1. "Key Genetic Insights" - Most important findings that impact health
2. "Potential Health Considerations" - Areas that may warrant attention
3. "Genetic Strengths" - Positive genetic variants
4. "Actionable Recommendations" - Evidence-based suggestions
${sharedGuidelines}`;

      specializedUserQuery = `Create a comprehensive summary of my genetic profile that highlights the most significant findings and provides actionable insights. Focus on the most important health implications of my genetic variants.`;
      break;

    case 'methylation':
      specializedPrompt += `${metadataSection}
TASK: Analyze methylation-related genetic markers to assess the user's methylation cycle function.

KEY METHYLATION MARKERS:
${snpText}

CRITICAL GENES TO FOCUS ON:
- MTHFR (rs1801133, rs1801131) - Folate metabolism and methylation
- CBS (rs234706) - Homocysteine metabolism 
- MTR (rs1805087) - Methionine synthase, B12-dependent methylation
- MTRR (rs1801394) - Methionine synthase reductase
- COMT (rs4680) - Catechol-O-methyltransferase, neurotransmitter metabolism

ANALYSIS REQUIREMENTS:
- Assess methylation cycle efficiency based on the available markers
- Evaluate homocysteine metabolism implications
- Analyze folate and B-vitamin metabolism
- Discuss implications for neurotransmitter metabolism if relevant
- Provide methyl donor considerations

SPECIFIC SECTIONS TO INCLUDE:
1. "Methylation Pathway Analysis" - Overall assessment of methylation function
2. "Nutrient Metabolism" - How variants affect B-vitamin needs
3. "Homocysteine Considerations" - Potential impact on homocysteine levels
4. "Methylation Support Strategies" - Evidence-based recommendations
${sharedGuidelines}`;

      specializedUserQuery = `Analyze my methylation-related genetic markers and provide insights about my methylation cycle function. Focus on MTHFR, CBS, MTR, and other key methylation genes, explaining how these variants might impact my health and what nutritional considerations would be appropriate.`;
      break;

    case 'carrier':
      specializedPrompt += `${metadataSection}
TASK: Analyze genetic markers associated with carrier status for inherited conditions.

KEY CARRIER STATUS MARKERS:
${snpText}

CRITICAL GENES TO FOCUS ON:
- CFTR (rs113993960) - Cystic fibrosis
- HEXA (rs80338939) - Tay-Sachs disease
- ASPA (rs28897696) - Canavan disease
- SMN1 (rs28897617) - Spinal muscular atrophy
- HBB (rs334) - Sickle cell anemia
- G6PD (rs1050828) - Glucose-6-phosphate dehydrogenase deficiency

ANALYSIS REQUIREMENTS:
- Determine carrier status for recessive genetic conditions
- Assess heterozygous vs homozygous status for each variant
- Explain the clinical significance of each relevant marker
- Provide context about population frequency
- Discuss implications for family planning if appropriate

SPECIFIC SECTIONS TO INCLUDE:
1. "Carrier Status Overview" - Summary of all findings
2. "Detailed Variant Analysis" - Gene-by-gene assessment
3. "Clinical Implications" - Relevance to health and reproduction
4. "Limitations and Considerations" - Explain what wasn't tested
${sharedGuidelines}`;

      specializedUserQuery = `Analyze my genetic markers for carrier status of inherited conditions. Determine if I carry any variants associated with recessive genetic disorders like cystic fibrosis, Tay-Sachs, or others. Explain the clinical significance of any findings and what they mean for family planning.`;
      break;

    case 'nutrition':
      specializedPrompt += `${metadataSection}
TASK: Analyze genetic markers related to nutrition, diet response, and nutrient metabolism.

KEY NUTRITION-RELATED MARKERS:
${snpText}

CRITICAL GENES TO FOCUS ON:
- MCM6/LCT (rs4988235) - Lactose tolerance/intolerance
- APOE (rs429358, rs7412) - Fat metabolism and response
- MTHFR (rs1801133, rs1801131) - Folate metabolism
- FUT2 (rs601338) - Vitamin B12 absorption
- VDR (rs1544410) - Vitamin D receptor function
- BCMO1 (rs12934922) - Beta-carotene conversion
- HFE (rs1800562, rs1799945) - Iron absorption and hemochromatosis risk

ANALYSIS REQUIREMENTS:
- Assess macronutrient metabolism and optimal ratios
- Evaluate micronutrient needs and potential deficiency risks
- Analyze dietary sensitivity patterns (lactose, gluten, etc.)
- Determine optimal diet type based on genetic variants
- Provide specific nutrient recommendations

SPECIFIC SECTIONS TO INCLUDE:
1. "Macronutrient Metabolism" - Protein, fat, carbohydrate processing
2. "Micronutrient Needs" - Vitamins and minerals requiring attention
3. "Food Sensitivities" - Genetic predispositions to food intolerances
4. "Dietary Recommendations" - Evidence-based nutritional guidance
${sharedGuidelines}`;

      specializedUserQuery = `Analyze my nutrition-related genetic markers and provide personalized dietary insights. Focus on how my genes affect macronutrient metabolism, micronutrient needs, and potential food sensitivities. Include specific recommendations for my optimal diet based on my genetic profile.`;
      break;

    case 'exercise':
      specializedPrompt += `${metadataSection}
TASK: Analyze genetic markers related to exercise response, recovery, and athletic performance.

KEY EXERCISE-RELATED MARKERS:
${snpText}

CRITICAL GENES TO FOCUS ON:
- ACTN3 (rs1815739) - Fast-twitch muscle fiber composition
- ACE (rs1799752) - Endurance vs. power performance
- PPARA (rs4253778) - Energy metabolism, endurance capacity
- PPARGC1A (rs8192678) - Mitochondrial function, aerobic capacity
- COL5A1 (rs12722) - Collagen production, injury risk
- VEGF (rs2010963) - Vascular growth, oxygen delivery
- IL6 (rs1800795) - Recovery and inflammation response

ANALYSIS REQUIREMENTS:
- Determine power vs. endurance genetic profile
- Assess injury risk factors
- Evaluate recovery efficiency
- Analyze optimal training response patterns
- Provide exercise recommendations aligned with genetic predispositions

SPECIFIC SECTIONS TO INCLUDE:
1. "Exercise Response Profile" - Power vs. endurance tendencies
2. "Recovery Factors" - Genetic influences on recovery capacity
3. "Injury Risk Assessment" - Genetic factors affecting injury potential
4. "Training Recommendations" - Personalized exercise strategies
${sharedGuidelines}`;

      specializedUserQuery = `Analyze my exercise-related genetic markers and provide insights about my optimal fitness approach. Focus on power vs. endurance tendencies, recovery factors, injury risks, and the types of training my body might respond to best based on my genetic profile.`;
      break;

    case 'medication':
      specializedPrompt += `${metadataSection}
TASK: Analyze pharmacogenomic markers related to medication metabolism and response.

KEY PHARMACOGENOMIC MARKERS:
${snpText}

CRITICAL GENES TO FOCUS ON:
- CYP2D6 (rs3892097) - Metabolism of many medications including antidepressants
- CYP2C19 (rs4244285) - Metabolism of proton pump inhibitors, antidepressants
- CYP2C9 (rs1799853, rs1057910) - Warfarin and NSAID metabolism
- VKORC1 (rs9923231) - Warfarin sensitivity
- SLCO1B1 (rs4149056) - Statin transport and side effects
- CYP1A2 (rs762551) - Caffeine and some medication metabolism
- COMT (rs4680) - Dopamine regulation, pain medication response

ANALYSIS REQUIREMENTS:
- Classify metabolizer status for key drug-processing enzymes
- Evaluate potential medication response variations
- Identify potential adverse reaction risks
- Provide guidance on medication considerations
- Include clinically validated gene-drug interactions

SPECIFIC SECTIONS TO INCLUDE:
1. "Medication Metabolism Profile" - CYP enzyme function overview
2. "Drug-Specific Considerations" - Implications for common medications
3. "Potential Sensitivities" - Areas requiring caution
4. "Clinical Recommendations" - Guidance for healthcare discussions
${sharedGuidelines}`;

      specializedUserQuery = `Analyze my pharmacogenomic markers and provide insights about how my body processes medications. Focus on my metabolizer status for key enzymes like CYP2D6, CYP2C19, and CYP2C9, and explain how these variations might affect my response to common medications. Include information about potential sensitivities or adverse reactions I should be aware of.`;
      break;

    case 'ancestry':
      specializedPrompt += `${metadataSection}
TASK: Analyze ancestry-informative markers to determine genetic heritage and population origins.

KEY ANCESTRY-INFORMATIVE MARKERS:
${snpText}

CRITICAL GENES TO FOCUS ON:
- SLC45A2 (rs16891982) - European/non-European ancestry
- SLC24A5 (rs1426654) - European/African ancestry
- EDAR (rs3827760) - East Asian ancestry
- DARC (rs2814778) - African ancestry
- HERC2 (rs12913832) - European eye color and ancestry
- LCT (rs4988235) - European ancestry, lactase persistence
- RHD (rs590787) - Blood type and regional ancestry associations

ANALYSIS REQUIREMENTS:
- Identify likely continental ancestry components
- Analyze regional population affiliations when possible
- Evaluate admixture patterns if evident
- Discuss haplogroup information if markers are available
- Provide historical context for genetic heritage

SPECIFIC SECTIONS TO INCLUDE:
1. "Ancestry Composition" - Continental and regional genetic heritage
2. "Population Affiliations" - Specific population connections
3. "Historical Context" - Migration patterns relevant to genetic profile
4. "Trait Associations" - Ancestry-related trait information
${sharedGuidelines}`;

      specializedUserQuery = `Analyze my ancestry-informative genetic markers and provide insights about my genetic heritage. Identify my likely continental and regional ancestry components, any admixture patterns, and provide historical context for my genetic profile.`;
      break;

    case 'diseaseRisk':
      specializedPrompt += `${metadataSection}
TASK: Analyze genetic markers associated with disease risk and health predispositions.

KEY DISEASE RISK MARKERS:
${snpText}

CRITICAL GENES TO FOCUS ON:
- APOE (rs429358, rs7412) - Cardiovascular health and cognitive function
- MTHFR (rs1801133) - Cardiovascular health considerations
- 9p21 locus (rs10757278) - Cardiovascular disease risk
- TCF7L2 (rs7903146) - Type 2 diabetes risk
- FTO (rs9939609) - Obesity risk factor
- BRCA1/2 (if present) - Breast and ovarian cancer risk factors
- GDF5 (rs143383) - Osteoarthritis risk
- SMAD7 (rs4939827) - Colorectal cancer risk association

ANALYSIS REQUIREMENTS:
- Evaluate genetic risk factors with strong scientific evidence
- Provide context about relative risk vs. absolute risk
- Compare genetic findings to general population risk
- Emphasize modifiable factors that interact with genetic risk
- Include preventative strategies and screening recommendations

SPECIFIC SECTIONS TO INCLUDE:
1. "Risk Assessment Overview" - Summary of key findings
2. "Cardiovascular Health Factors" - Heart and vascular health markers
3. "Metabolic Health Considerations" - Diabetes and related conditions
4. "Other Health Predispositions" - Additional significant findings
5. "Preventative Strategies" - Evidence-based risk reduction approaches
${sharedGuidelines}`;

      specializedUserQuery = `Analyze my disease risk genetic markers and provide insights about my health predispositions. Focus on evidence-based associations, explaining relative risk compared to the general population, and include preventative strategies that could help mitigate any genetic risks identified.`;
      break;

    default:
      // If no specific report type matches, use a general prompt
      specializedPrompt += `${metadataSection}
TASK: Analyze the provided genetic markers to give the user actionable health insights.

KEY GENETIC MARKERS:
${snpText}

ANALYSIS REQUIREMENTS:
- Identify the most significant health-related findings
- Provide context for each relevant genetic variant
- Explain potential implications for health and wellness
- Offer evidence-based recommendations when appropriate
- Cover multiple health domains (metabolism, response to environment, etc.)

SPECIFIC SECTIONS TO INCLUDE:
1. "Key Genetic Findings" - Most significant variants
2. "Health Implications" - Potential impact on health
3. "Actionable Insights" - Practical recommendations
4. "Limitations" - What this analysis doesn't cover
${sharedGuidelines}`;

      specializedUserQuery = `Analyze my genetic markers and provide a comprehensive health assessment based on my DNA data. Focus on the most significant findings that may impact my health and wellness, and include actionable recommendations.`;
  }

  return { prompt: specializedPrompt, userQuery: specializedUserQuery };
} 