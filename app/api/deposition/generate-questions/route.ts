import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { chatCompletion } from '@/lib/case-dev/api';
import { DEMO_LIMITS } from '@/lib/demo-limits/config';
import type { DepositionQuestion, TestimonyGap, Contradiction } from '@/lib/types/deposition';

// Dynamic system prompt
function getDepositionAnalysisPrompt(deponentName: string): string {
  return `You are an experienced litigation attorney preparing to take a deposition of ${deponentName}. Analyze the provided case documents and generate strategic deposition questions that are SPECIFIC to the document contents.

═══════════════════════════════════════════════════════════════════════════════
WITNESS IDENTITY - READ THIS CAREFULLY:
═══════════════════════════════════════════════════════════════════════════════
THE PERSON YOU ARE QUESTIONING IS: ${deponentName}
THE PERSON YOU ARE QUESTIONING IS: ${deponentName}
THE PERSON YOU ARE QUESTIONING IS: ${deponentName}

⚠️ CRITICAL WARNING:
The documents may contain depositions or statements from OTHER people who are NOT ${deponentName}.
The ONLY person you are questioning is ${deponentName}.

When you see testimony from other people:
- Ask ${deponentName} what THEY know about what those other people said
- NEVER direct questions to those other people
═══════════════════════════════════════════════════════════════════════════════

CRITICAL REQUIREMENTS:
- ALL questions MUST be directed TO ${deponentName} using "you" and "your"
- ALL questions MUST reference specific facts, dates, names, or details from documents
- DO NOT include generic questions like "state your name"
- Every question should probe specific document content

ANALYSIS OBJECTIVES:
1. Identify GAPS - missing or incomplete information in documents
2. Detect CONTRADICTIONS - inconsistencies between documents
3. Extract KEY THEMES - major topics from documents
4. Build TIMELINE - chronological events from documents
5. Generate STRATEGIC QUESTIONS - reference specific document content

Return JSON object with this structure:
{
  "gaps": [{
    "description": "Gap description with document references",
    "documentReferences": ["Document names"],
    "severity": "minor|moderate|significant",
    "suggestedQuestions": ["Question 1", "Question 2"]
  }],
  "contradictions": [{
    "description": "Contradiction with quotes",
    "source1": {"document": "Name", "excerpt": "Quote"},
    "source2": {"document": "Name", "excerpt": "Quote"},
    "severity": "minor|moderate|significant",
    "suggestedQuestions": ["Question"]
  }],
  "analysis": {
    "keyThemes": ["Theme 1", "Theme 2"],
    "timelineEvents": [{"date": "Date", "event": "Event", "source": "Doc"}],
    "witnesses": ["Names mentioned"],
    "keyExhibits": ["Important exhibits"]
  },
  "questions": [{
    "question": "Question referencing specific document content directed to ${deponentName}",
    "topic": "Topic area",
    "category": "gap|contradiction|timeline|foundation|impeachment|follow_up|general",
    "priority": "high|medium|low",
    "documentReference": "Document name",
    "rationale": "Why this matters",
    "followUpQuestions": ["Follow-up 1", "Follow-up 2"]
  }]
}

IMPORTANT: Return ONLY the JSON object. No markdown, no code blocks.`;
}

// Extract document details
function extractDocumentDetails(documents: Array<{ name: string; content?: string; type?: string }>) {
  const names = new Set<string>();
  const dates = new Set<string>();
  const amounts = new Set<string>();
  const locations = new Set<string>();
  const keyPhrases = new Set<string>();
  const documentSummaries: Array<{ name: string; summary: string }> = [];

  for (const doc of documents) {
    const content = doc.content || '';
    
    // Extract names (capitalized words, 2-3 words)
    const nameMatches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g) || [];
    nameMatches.slice(0, 5).forEach(n => names.add(n));
    
    // Extract dates
    const dateMatches = content.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/gi) || [];
    dateMatches.slice(0, 5).forEach(d => dates.add(d));
    
    // Extract monetary amounts
    const amountMatches = content.match(/\$[\d,]+(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\s*(?:dollars?|USD)?\b/gi) || [];
    amountMatches.slice(0, 3).forEach(a => amounts.add(a));
    
    // Extract locations
    const locationMatches = content.match(/\b(?:in|at|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,\s*[A-Z]{2})?)\b/g) || [];
    locationMatches.slice(0, 3).forEach(l => locations.add(l.replace(/^(?:in|at|from|to)\s+/i, '')));
    
    // Extract key phrases
    const phraseMatches = content.match(/"[^"]{10,100}"|'[^']{10,100}'|stated that [^.]{10,80}|claimed that [^.]{10,80}|testified that [^.]{10,80}/gi) || [];
    phraseMatches.slice(0, 3).forEach(p => keyPhrases.add(p));
    
    // Create document summary
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20).slice(0, 2);
    if (sentences.length > 0) {
      documentSummaries.push({
        name: doc.name,
        summary: sentences.join('. ').trim().substring(0, 200)
      });
    }
  }

  return {
    names: Array.from(names),
    dates: Array.from(dates),
    amounts: Array.from(amounts),
    locations: Array.from(locations),
    keyPhrases: Array.from(keyPhrases),
    documentSummaries
  };
}

// Generate fallback with document analysis
function generateFallbackAnalysis(deponentName: string, documents: Array<{ name: string; content?: string; type?: string }>) {
  const docNames = documents.map(d => d.name);
  const details = extractDocumentDetails(documents);
  
  const gaps: TestimonyGap[] = [];
  const contradictions: Contradiction[] = [];
  const questions: DepositionQuestion[] = [];

  // Generate document-specific gaps
  if (details.dates.length > 0) {
    gaps.push({
      id: uuidv4(),
      description: `Timeline details around ${details.dates[0]} need clarification - documents reference this date but lack context`,
      documentReferences: docNames.slice(0, 2),
      severity: 'moderate',
      suggestedQuestions: [
        `What specifically happened on ${details.dates[0]}?`,
        `Who else was involved in the events of ${details.dates[0]}?`
      ],
    });
  }

  if (details.names.length > 1) {
    gaps.push({
      id: uuidv4(),
      description: `The relationship between ${details.names[0]} and ${details.names[1]} is not fully documented`,
      documentReferences: docNames.slice(0, 1),
      severity: 'significant',
      suggestedQuestions: [
        `What was the nature of your communications with ${details.names[1]}?`,
        `How often did you interact with ${details.names[1]}?`
      ],
    });
  }

  // Generate document-specific questions
  details.dates.forEach((date, index) => {
    if (index < 3) {
      questions.push({
        id: uuidv4(),
        question: `The documents reference ${date}. Walk me through exactly what happened on that date and your involvement.`,
        topic: 'Timeline of Events',
        category: 'timeline',
        priority: index === 0 ? 'high' : 'medium',
        documentReference: docNames[0] || 'Documents',
        rationale: `This date appears in the documents and establishing specific events is critical.`,
        followUpQuestions: [
          `Who else was present on ${date}?`,
          `What communications occurred before and after ${date}?`
        ],
      });
    }
  });

  // Add questions for key people mentioned
  details.names.forEach((name, index) => {
    if (index < 3) {
      questions.push({
        id: uuidv4(),
        question: `${name} is mentioned in the documents. Describe your relationship and interactions with ${name}.`,
        topic: 'Relationships and Communications',
        category: 'foundation',
        priority: 'medium',
        documentReference: docNames[0] || 'Documents',
        rationale: `Understanding relationships with key individuals is essential.`,
        followUpQuestions: [
          `How often did you communicate with ${name}?`,
          `What was the nature of your professional relationship?`
        ],
      });
    }
  });

  // Add general deposition questions
  const generalQuestions: DepositionQuestion[] = [
    {
      id: uuidv4(),
      question: `You've reviewed documents for this case. Walk me through your role and responsibilities during the time period covered by these documents.`,
      topic: 'Role and Responsibilities',
      category: 'foundation',
      priority: 'high',
      documentReference: 'General',
      rationale: `Establishes foundation for testimony and scope of knowledge.`,
      followUpQuestions: [
        `What were your specific duties?`,
        `Who did you report to?`
      ],
    },
    {
      id: uuidv4(),
      question: `Do you have any personal or financial interest in the outcome of this case?`,
      topic: 'Bias',
      category: 'impeachment',
      priority: 'high',
      documentReference: 'General',
      rationale: `Establishes potential bias.`,
      followUpQuestions: [
        `Do you stand to gain financially?`,
        `What is your current relationship with the parties?`
      ],
    }
  ];

  questions.push(...generalQuestions);

  const analysis = {
    keyThemes: details.names.length > 0 
      ? [`Involvement of ${details.names.slice(0, 2).join(' and ')}`, 'Timeline of Events', 'Document Authenticity']
      : ['Timeline of Events', 'Document Authenticity', 'Communications'],
    timelineEvents: details.dates.map((date, i) => ({
      date,
      event: `Event referenced in documents`,
      source: docNames[i % docNames.length] || 'Documents'
    })),
    witnesses: details.names.slice(0, 5),
    keyExhibits: docNames.slice(0, 5),
  };

  return { gaps, contradictions, questions, analysis };
}

// POST /api/deposition/generate-questions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deponentName, caseName, documents } = body;

    if (!deponentName || !caseName) {
      return NextResponse.json(
        { error: 'deponentName and caseName are required' },
        { status: 400 }
      );
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'No documents provided' },
        { status: 400 }
      );
    }

    // Prepare document context
    const documentContext = documents
      .map((doc: { name: string; content?: string; type?: string }) => {
        const content = doc.content || '[Content not available]';
        const typeLabel = (doc.type || 'DOCUMENT').replace('_', ' ').toUpperCase();
        return `=== ${typeLabel}: ${doc.name} ===\n${content}\n=== END DOCUMENT ===`;
      })
      .join('\n\n');

    const userPrompt = `Case: ${caseName}
Deponent (Witness Name): ${deponentName}

DOCUMENTS TO ANALYZE:
${documentContext}

Based on these documents, perform comprehensive analysis and generate 15-20 strategic deposition questions.

CRITICAL: ALL questions MUST be directed TO ${deponentName}. Use "you" and "your".
Every question MUST reference specific facts, dates, names, or details from the documents above.

CRITICAL: Return ONLY a valid JSON object. No markdown formatting, no code blocks.`;

    let result: {
      gaps: TestimonyGap[];
      contradictions: Contradiction[];
      questions: DepositionQuestion[];
      analysis: {
        keyThemes: string[];
        timelineEvents: Array<{ date: string; event: string; source: string }>;
        witnesses: string[];
        keyExhibits: string[];
      };
    };
    let usedFallback = false;
    let cost = 0;
    let charsProcessed = 0;

    try {
      const response = await chatCompletion(
        [
          { role: 'system', content: getDepositionAnalysisPrompt(deponentName) },
          { role: 'user', content: userPrompt },
        ],
        {
          model: 'casemark/casemark-core-1',
          temperature: 0.7,
          max_tokens: 8000,
        }
      );

      const content = response.choices?.[0]?.message?.content || '';

      // Calculate cost
      charsProcessed = (getDepositionAnalysisPrompt(deponentName) + userPrompt + content).length;
      cost = (charsProcessed / 1000) * DEMO_LIMITS.pricing.pricePerThousandChars;

      if (content) {
        try {
          // Try to parse JSON response
          let cleaned = content.trim();
          cleaned = cleaned.replace(/^\uFEFF/, '');
          cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
          cleaned = cleaned.replace(/\n?```\s*$/i, '');
          cleaned = cleaned.trim();

          const parsed = JSON.parse(cleaned);
          
          // Add IDs to questions, gaps, contradictions
          if (parsed.questions) {
            parsed.questions = parsed.questions.map((q: any) => ({
              ...q,
              id: q.id || uuidv4()
            }));
          }
          if (parsed.gaps) {
            parsed.gaps = parsed.gaps.map((g: any) => ({
              ...g,
              id: g.id || uuidv4()
            }));
          }
          if (parsed.contradictions) {
            parsed.contradictions = parsed.contradictions.map((c: any) => ({
              ...c,
              id: c.id || uuidv4()
            }));
          }

          result = parsed;
        } catch (parseError) {
          console.error('Failed to parse LLM response, using fallback');
          result = generateFallbackAnalysis(deponentName, documents);
          usedFallback = true;
        }
      } else {
        result = generateFallbackAnalysis(deponentName, documents);
        usedFallback = true;
      }
    } catch (apiError) {
      console.error('LLM API error:', apiError);
      result = generateFallbackAnalysis(deponentName, documents);
      usedFallback = true;
    }

    // Ensure result has all required fields
    if (!result.gaps) result.gaps = [];
    if (!result.contradictions) result.contradictions = [];
    if (!result.questions) result.questions = [];
    if (!result.analysis) {
      result.analysis = {
        keyThemes: [],
        timelineEvents: [],
        witnesses: [],
        keyExhibits: []
      };
    }

    return NextResponse.json({
      ...result,
      cost,
      charsProcessed,
      usedFallback,
    });
  } catch (error) {
    console.error('Error generating deposition analysis:', error);
    return NextResponse.json(
      { error: 'Failed to generate analysis' },
      { status: 500 }
    );
  }
}
