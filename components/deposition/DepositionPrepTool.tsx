'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import {
  Users,
  Upload,
  FileText,
  ChatCircle,
  CaretRight,
  SpinnerGap,
  X,
  Lightbulb,
  WarningCircle,
  CheckCircle,
  Warning,
  MagnifyingGlass,
  List,
  DownloadSimple,
  CaretDown,
  CaretUp,
  Clock,
  Target,
  Lightning,
} from '@phosphor-icons/react';
import type {
  DepositionSession,
  DepositionDocument,
  DepositionQuestion,
  TestimonyGap,
  Contradiction,
  OutlineSection,
} from '@/lib/types/deposition';
import {
  createDepositionSession,
  getDepositionSession,
  updateDepositionSession,
  addDepositionDocument,
  setDepositionQuestions,
  setAnalysisResults,
} from '@/lib/storage/deposition-storage';
import {
  getSessionStats,
  incrementSessionPrice,
  formatPrice,
} from '@/lib/storage/usage-storage';
import { DEMO_LIMITS } from '@/lib/demo-limits/config';
import { UsageMeter } from '@/components/demo/UsageMeter';
import { LimitWarning } from '@/components/demo/LimitWarning';

type AppStep = 'setup' | 'documents' | 'analysis' | 'questions' | 'outline';

// Document type detection
function detectDocumentType(filename: string, content?: string): DepositionDocument['type'] {
  const lowerName = filename.toLowerCase();
  const lowerContent = (content || '').toLowerCase();

  if (lowerName.includes('transcript') || lowerName.includes('deposition') ||
      lowerContent.includes('q:') || lowerContent.includes('a:')) {
    return 'transcript';
  }
  if (lowerName.includes('testimony') || lowerName.includes('statement') ||
      lowerContent.includes('sworn') || lowerContent.includes('under oath')) {
    return 'prior_testimony';
  }
  if (lowerName.includes('exhibit') || /ex[-_]?\d+/i.test(lowerName)) {
    return 'exhibit';
  }
  if (lowerName.includes('complaint') || lowerName.includes('motion') ||
      lowerName.includes('brief') || lowerName.includes('filing')) {
    return 'case_file';
  }
  return 'other';
}

export default function DepositionPrepTool() {
  // Session state
  const [session, setSession] = useState<DepositionSession | null>(null);
  const [currentStep, setCurrentStep] = useState<AppStep>('setup');

  // Form state
  const [deponentName, setDeponentName] = useState('');
  const [caseName, setCaseName] = useState('');
  const [caseNumber, setCaseNumber] = useState('');

  // Loading states
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isOrganizingOutline, setIsOrganizingOutline] = useState(false);

  // Error and limit state
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState<'priceLimit' | 'documentLimit' | null>(null);

  // Usage tracking
  const [priceUsed, setPriceUsed] = useState(0);
  const [documentsUsed, setDocumentsUsed] = useState(0);

  // UI state
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);

  // Load session and stats on mount
  useEffect(() => {
    const stats = getSessionStats();
    setPriceUsed(stats.sessionPrice);
    setDocumentsUsed(stats.documentsUploaded);

    const savedSessionId = typeof window !== 'undefined'
      ? localStorage.getItem('wtp_current_deposition_session')
      : null;
    if (savedSessionId) {
      const savedSession = getDepositionSession(savedSessionId);
      if (savedSession) {
        setSession(savedSession);
        // Determine which step to show
        if (savedSession.outline) {
          setCurrentStep('outline');
        } else if (savedSession.questions.length > 0) {
          setCurrentStep('questions');
        } else if (savedSession.documents.length > 0) {
          setCurrentStep('documents');
        }
      }
    }
  }, []);

  // Save current session ID
  useEffect(() => {
    if (session && typeof window !== 'undefined') {
      localStorage.setItem('wtp_current_deposition_session', session.id);
    }
  }, [session?.id]);

  // Clear error after timeout
  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), 10000);
  };

  // Create a new session
  const handleCreateSession = async () => {
    if (!deponentName.trim() || !caseName.trim()) return;

    setIsCreatingSession(true);
    setError(null);

    try {
      const newSession = createDepositionSession(deponentName.trim(), caseName.trim(), caseNumber.trim() || undefined);
      setSession(newSession);
      setCurrentStep('documents');
    } catch (err) {
      console.error('Error creating session:', err);
      showError('Failed to create session. Please try again.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Reset session
  const resetToSetup = useCallback(() => {
    setSession(null);
    setCurrentStep('setup');
    setDeponentName('');
    setCaseName('');
    setCaseNumber('');
    setError(null);
    setLimitReached(null);
    // Don't reset priceUsed/documentsUsed - they persist across deposition sessions
    // Reload from session stats instead
    const stats = getSessionStats();
    setPriceUsed(stats.sessionPrice);
    setDocumentsUsed(stats.documentsUploaded);
    setExpandedQuestions(new Set());
    setSelectedTopic(null);
    setSelectedPriority(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wtp_current_deposition_session');
    }
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || !session) return;

    // Check document limit
    if (session.documents.length >= DEMO_LIMITS.documents.maxDocumentsPerSession) {
      setLimitReached('documentLimit');
      showError(`Demo limit: Maximum ${DEMO_LIMITS.documents.maxDocumentsPerSession} documents per session`);
      return;
    }

    setIsUploadingDocument(true);
    setError(null);

    for (const file of Array.from(files)) {
      // Check document limit again for each file
      if (session.documents.length >= DEMO_LIMITS.documents.maxDocumentsPerSession) {
        showError(`Demo limit reached: Maximum ${DEMO_LIMITS.documents.maxDocumentsPerSession} documents`);
        break;
      }

      // Check file size
      if (file.size > DEMO_LIMITS.documents.maxFileSize) {
        showError(`File "${file.name}" exceeds ${DEMO_LIMITS.documents.maxFileSize / (1024 * 1024)}MB limit`);
        continue;
      }

      try {
        // Read file content
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });

        const docType = detectDocumentType(file.name, content);
        const pageCount = Math.ceil(content.length / 3000);

        const newDoc: DepositionDocument = {
          id: uuidv4(),
          name: file.name,
          type: docType,
          fileType: file.type || 'text/plain',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          content,
          status: 'ready',
          metadata: {
            pageCount,
            source: file.name,
          },
        };

        const updated = addDepositionDocument(session.id, newDoc);
        if (updated) {
          setDocumentsUsed(prev => prev + 1);
          setSession(updated);
        }
      } catch (err) {
        console.error('Error uploading file:', err);
        showError(`Failed to upload ${file.name}`);
      }
    }

    setIsUploadingDocument(false);
  }, [session]);

  // Generate questions via API
  const generateQuestions = async () => {
    if (!session || session.documents.length === 0) return;

    setIsGeneratingQuestions(true);
    setError(null);

    try {
      const response = await fetch('/api/deposition/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deponentName: session.deponentName,
          caseName: session.caseName,
          documents: session.documents.map(d => ({
            name: d.name,
            content: d.content || '',
            type: d.type,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.limitReached) {
          setLimitReached('priceLimit');
          return;
        }
        showError(data.error || 'Failed to generate questions');
        return;
      }

      // Track cost
      if (data.cost) {
        incrementSessionPrice(data.cost);
        setPriceUsed((prev) => prev + data.cost);
      }

      // Update session with questions and analysis from API
      const questions: DepositionQuestion[] = data.questions || [];
      const gaps: TestimonyGap[] = data.gaps || [];
      const contradictions: Contradiction[] = data.contradictions || [];
      const analysis = data.analysis || {
        keyThemes: [],
        timelineEvents: [],
        witnesses: [],
        keyExhibits: [],
      };

      let updated = setDepositionQuestions(session.id, questions);
      updated = setAnalysisResults(session.id, gaps, contradictions, analysis);

      if (updated) {
        setSession(updated);
        setCurrentStep('analysis');
      }
    } catch (err) {
      console.error('Error generating questions:', err);
      showError('Failed to generate questions. Please try again.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  // Auto-organize outline
  const autoOrganizeOutline = async () => {
    if (!session || session.questions.length === 0) return;

    setIsOrganizingOutline(true);

    try {
      // Group questions by topic
      const topicGroups = new Map<string, DepositionQuestion[]>();
      const topicOrder = ['Foundation', 'Timeline', 'Gap', 'Contradiction', 'Impeachment', 'Follow-up', 'General'];

      session.questions.forEach(q => {
        const topic = q.topic || 'General';
        if (!topicGroups.has(topic)) {
          topicGroups.set(topic, []);
        }
        topicGroups.get(topic)!.push(q);
      });

      // Create sections
      const sections: OutlineSection[] = [];
      let order = 0;

      // First add topics in preferred order
      for (const topic of topicOrder) {
        const questions = topicGroups.get(topic);
        if (questions && questions.length > 0) {
          sections.push({
            id: uuidv4(),
            title: topic,
            order: order++,
            questions: questions.sort((a, b) => {
              const priorityOrder = { high: 0, medium: 1, low: 2 };
              return priorityOrder[a.priority] - priorityOrder[b.priority];
            }),
            estimatedTime: questions.length * 3,
          });
          topicGroups.delete(topic);
        }
      }

      // Add remaining topics
      for (const [topic, questions] of topicGroups) {
        sections.push({
          id: uuidv4(),
          title: topic,
          order: order++,
          questions: questions.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }),
          estimatedTime: questions.length * 3,
        });
      }

      const updated = updateDepositionSession(session.id, {
        outline: {
          id: uuidv4(),
          title: `Deposition Outline - ${session.deponentName}`,
          sections,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      if (updated) {
        setSession(updated);
        setCurrentStep('outline');
      }
    } catch (err) {
      console.error('Error organizing outline:', err);
      showError('Failed to organize outline');
    } finally {
      setIsOrganizingOutline(false);
    }
  };

  // Toggle question expansion
  const toggleQuestionExpansion = (questionId: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };

  // Badge classes
  const getCategoryBadgeClass = (category: string) => {
    const classes: Record<string, string> = {
      gap: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      contradiction: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      timeline: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      foundation: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      impeachment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      follow_up: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      general: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    };
    return classes[category] || classes.general;
  };

  const getPriorityBadgeClass = (priority: string) => {
    const classes: Record<string, string> = {
      high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    };
    return classes[priority] || classes.medium;
  };

  const getSeverityBadgeClass = (severity: string) => {
    const classes: Record<string, string> = {
      significant: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      minor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    };
    return classes[severity] || classes.moderate;
  };

  const getDocTypeBadgeClass = (type: string) => {
    const classes: Record<string, string> = {
      prior_testimony: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      exhibit: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      transcript: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      case_file: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    };
    return classes[type] || classes.other;
  };

  // Filter questions
  const filteredQuestions = session?.questions.filter(q => {
    if (selectedTopic && q.topic !== selectedTopic) return false;
    if (selectedPriority && q.priority !== selectedPriority) return false;
    return true;
  }) || [];

  const uniqueTopics = [...new Set(session?.questions.map(q => q.topic) || [])];

  // Export to PDF
  const exportToPDF = useCallback(() => {
    if (!session) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPosition = margin;

    const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10): number => {
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return y + lines.length * fontSize * 0.4;
    };

    const checkNewPage = (requiredSpace: number): void => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DEPOSITION OUTLINE', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Case info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Case: ${session.caseName}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
    doc.text(`Deponent: ${session.deponentName}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
    if (session.caseNumber) {
      doc.text(`Case No: ${session.caseNumber}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 6;
    }
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Questions
    const questionsToExport = session.outline?.sections
      ? session.outline.sections.flatMap((section, sectionIndex) =>
          section.questions.map((q, qIndex) => ({ ...q, sectionTitle: section.title, sectionIndex, questionIndex: qIndex }))
        )
      : session.questions.map((q, index) => ({ ...q, sectionTitle: q.topic, sectionIndex: 0, questionIndex: index }));

    let currentSection = '';
    let questionNumber = 1;

    questionsToExport.forEach(question => {
      if (question.sectionTitle !== currentSection) {
        checkNewPage(25);
        currentSection = question.sectionTitle;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPosition - 5, contentWidth, 10, 'F');
        doc.text(currentSection.toUpperCase(), margin + 5, yPosition + 2);
        yPosition += 15;
        questionNumber = 1;
      }

      checkNewPage(40);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const priorityIndicator = question.priority === 'high' ? '[HIGH]' : question.priority === 'medium' ? '[MED]' : '[LOW]';
      doc.text(`Q${questionNumber}. ${priorityIndicator}`, margin, yPosition);

      doc.setFont('helvetica', 'normal');
      yPosition = addWrappedText(question.question, margin + 5, yPosition + 5, contentWidth - 5, 11);
      yPosition += 3;

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      let metaText = `[${question.category.replace('_', ' ').toUpperCase()}]`;
      if (question.documentReference) metaText += ` | Doc: ${question.documentReference}`;
      doc.text(metaText, margin + 5, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 5;

      if (question.followUpQuestions?.length) {
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text('Follow-ups:', margin + 5, yPosition);
        yPosition += 5;
        question.followUpQuestions.forEach(fq => {
          checkNewPage(10);
          yPosition = addWrappedText(`- ${fq}`, margin + 10, yPosition, contentWidth - 15, 9);
          yPosition += 3;
        });
        doc.setTextColor(0, 0, 0);
      }

      yPosition += 8;
      questionNumber++;
    });

    // Page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${totalPages} | ${session.caseName} - Deposition of ${session.deponentName}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    const fileName = `Deposition_Outline_${session.deponentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }, [session]);

  // Error banner
  const ErrorBanner = () => {
    if (!error) return null;
    return (
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg">
          <WarningCircle className="w-5 h-5 text-red-600 dark:text-red-400" weight="fill" />
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 dark:text-red-400 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Render setup step
  const renderSetup = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Users className="w-8 h-8 text-primary" weight="duotone" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Deposition Prep Tool</h1>
        <p className="text-muted-foreground">
          Analyze case documents and generate strategic deposition questions
        </p>
      </div>

      <div className="bg-card rounded-xl shadow-lg p-8 border border-border">
        <h2 className="text-xl font-semibold mb-6">Start a New Deposition Prep</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Deponent Name</label>
            <input
              type="text"
              value={deponentName}
              onChange={e => setDeponentName(e.target.value)}
              placeholder="e.g., John Smith (Plaintiff)"
              className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Case Name</label>
            <input
              type="text"
              value={caseName}
              onChange={e => setCaseName(e.target.value)}
              placeholder="e.g., Smith v. ABC Corporation"
              className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Case Number <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={caseNumber}
              onChange={e => setCaseNumber(e.target.value)}
              placeholder="e.g., 2024-CV-12345"
              className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
            />
          </div>

          <button
            onClick={handleCreateSession}
            disabled={!deponentName.trim() || !caseName.trim() || isCreatingSession}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {isCreatingSession ? (
              <>
                <SpinnerGap className="w-5 h-5 animate-spin" />
                Creating Session...
              </>
            ) : (
              <>
                Start Deposition Prep
                <CaretRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg p-4 border border-border text-center">
          <Upload className="w-6 h-6 text-primary mx-auto mb-2" weight="duotone" />
          <p className="text-sm text-muted-foreground">Upload case files</p>
        </div>
        <div className="bg-card rounded-lg p-4 border border-border text-center">
          <MagnifyingGlass className="w-6 h-6 text-primary mx-auto mb-2" weight="duotone" />
          <p className="text-sm text-muted-foreground">AI analysis</p>
        </div>
        <div className="bg-card rounded-lg p-4 border border-border text-center">
          <ChatCircle className="w-6 h-6 text-primary mx-auto mb-2" weight="duotone" />
          <p className="text-sm text-muted-foreground">Generate questions</p>
        </div>
      </div>
    </div>
  );

  // Render loading screen
  const renderGeneratingQuestions = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-xl shadow-lg p-8 border border-border">
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse" />
            <MagnifyingGlass className="w-12 h-12 text-primary relative z-10 animate-bounce" weight="duotone" />
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-2">Analyzing Documents</h2>
          <p className="text-muted-foreground mb-6">
            Our AI is analyzing your case documents and generating strategic questions...
          </p>

          <div className="space-y-3 text-left max-w-md mx-auto mb-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" weight="fill" />
              </div>
              <span className="text-foreground">Documents uploaded ({session?.documents.length} files)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <SpinnerGap className="w-4 h-4 text-primary animate-spin" />
              </div>
              <span className="text-foreground">Identifying gaps and contradictions...</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              </div>
              <span className="text-muted-foreground">Generating strategic questions</span>
            </div>
          </div>

          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
          </div>

          <p className="text-sm text-muted-foreground mt-4">
            This typically takes 30-60 seconds depending on document complexity
          </p>
        </div>
      </div>
    </div>
  );

  // Render documents step
  const renderDocuments = () => {
    if (isGeneratingQuestions) return renderGeneratingQuestions();

    // Show limit warning if reached
    if (limitReached) {
      return (
        <div className="max-w-4xl mx-auto">
          <LimitWarning type={limitReached} onUpgrade={() => window.open('https://case.dev', '_blank')} />
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Upload Case Materials</h1>
            <p className="text-muted-foreground">
              {session?.caseName} • Deponent: {session?.deponentName}
            </p>
          </div>
          <button
            onClick={generateQuestions}
            disabled={!session?.documents.length || isGeneratingQuestions}
            className="py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            <Lightning className="w-5 h-5" weight="fill" />
            Generate Questions
          </button>
        </div>

        {/* Usage meters */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <UsageMeter
            label="Session Cost"
            used={priceUsed}
            limit={DEMO_LIMITS.pricing.sessionPriceLimit}
            isPriceFormat
          />
          <UsageMeter
            label="Documents"
            used={session?.documents.length || 0}
            limit={DEMO_LIMITS.documents.maxDocumentsPerSession}
          />
        </div>

        {/* Upload area */}
        <div
          className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition cursor-pointer bg-muted/50"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            handleFileUpload(e.dataTransfer.files);
          }}
          onClick={() => document.getElementById('deposition-file-input')?.click()}
        >
          <input
            id="deposition-file-input"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={e => handleFileUpload(e.target.files)}
          />

          {isUploadingDocument ? (
            <div className="flex flex-col items-center">
              <SpinnerGap className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Uploading document...</p>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" weight="duotone" />
              <p className="text-lg font-medium text-foreground mb-1">Drop files here or click to upload</p>
              <p className="text-sm text-muted-foreground">Prior testimony, exhibits, transcripts, and case files</p>
            </>
          )}
        </div>

        {/* Document list */}
        {session?.documents && session.documents.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Uploaded Documents ({session.documents.length})</h3>
            <div className="space-y-2">
              {session.documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-4 bg-card rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" weight="duotone" />
                    <div>
                      <p className="font-medium text-foreground">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDocTypeBadgeClass(doc.type)}`}>
                          {doc.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">{(doc.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${doc.status === 'ready' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700'}`}>
                    {doc.status === 'ready' ? 'Ready' : 'Processing'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick navigation if analysis/questions exist */}
        {(() => {
          const hasAnalysis = (session?.gaps && session.gaps.length > 0) || (session?.contradictions && session.contradictions.length > 0);
          const hasQuestions = (session?.questions?.length || 0) > 0;
          return (hasAnalysis || hasQuestions) ? (
            <div className="mt-6 flex gap-3">
              {hasAnalysis && (
                <button
                  onClick={() => setCurrentStep('analysis')}
                  className="flex-1 py-3 px-4 bg-card border-2 border-primary/30 text-foreground rounded-lg font-medium hover:bg-primary/10 hover:border-primary transition flex items-center justify-center gap-2"
                >
                  <MagnifyingGlass className="w-5 h-5 text-primary" weight="duotone" />
                  View Analysis
                </button>
              )}
              {hasQuestions && (
                <button
                  onClick={() => setCurrentStep('questions')}
                  className="flex-1 py-3 px-4 bg-card border-2 border-primary/30 text-foreground rounded-lg font-medium hover:bg-primary/10 hover:border-primary transition flex items-center justify-center gap-2"
                >
                  <ChatCircle className="w-5 h-5 text-primary" weight="duotone" />
                  View Questions
                </button>
              )}
            </div>
          ) : null;
        })()}

        {/* Tips */}
        <div className="mt-6 bg-primary/10 rounded-lg p-4 border border-primary/20">
          <div className="flex gap-3">
            <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" weight="fill" />
            <div>
              <p className="font-medium text-foreground">Tips for better analysis</p>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• Upload <strong>prior testimony</strong> to identify contradictions</li>
                <li>• Include <strong>exhibits</strong> you plan to use during the deposition</li>
                <li>• Add <strong>transcripts</strong> from other depositions in the case</li>
                <li>• Use <strong>text files (.txt)</strong> for best content extraction</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render analysis step
  const renderAnalysis = () => {
    // Show limit warning if reached
    if (limitReached) {
      return (
        <div className="max-w-6xl mx-auto">
          <LimitWarning type={limitReached} onUpgrade={() => window.open('https://case.dev', '_blank')} />
        </div>
      );
    }

    return (
    <div className="max-w-6xl mx-auto">
      {/* Usage meters */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <UsageMeter label="Session Cost" used={priceUsed} limit={DEMO_LIMITS.pricing.sessionPriceLimit} isPriceFormat />
        <UsageMeter label="Documents" used={session?.documents.length || 0} limit={DEMO_LIMITS.documents.maxDocumentsPerSession} />
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analysis Results</h1>
          <p className="text-muted-foreground">
            Found {session?.gaps.length || 0} gaps, {session?.contradictions.length || 0} contradictions, {session?.questions.length || 0} questions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentStep('questions')}
            className="py-2 px-4 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition flex items-center gap-2"
          >
            <ChatCircle className="w-5 h-5" weight="duotone" />
            View Questions
          </button>
          <button
            onClick={autoOrganizeOutline}
            disabled={isOrganizingOutline}
            className="py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:bg-muted transition flex items-center gap-2"
          >
            {isOrganizingOutline ? <SpinnerGap className="w-5 h-5 animate-spin" /> : <List className="w-5 h-5" weight="duotone" />}
            Build Outline
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Themes */}
        {session?.analysis?.keyThemes && session.analysis.keyThemes.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" weight="duotone" />
              Key Themes
            </h3>
            <div className="flex flex-wrap gap-2">
              {session.analysis.keyThemes.map((theme, index) => (
                <span key={index} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Key Exhibits */}
        {session?.analysis?.keyExhibits && session.analysis.keyExhibits.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" weight="duotone" />
              Key Exhibits
            </h3>
            <div className="space-y-2">
              {session.analysis.keyExhibits.map((exhibit, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-medium">{index + 1}</span>
                  <span className="text-foreground">{exhibit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Testimony Gaps */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Warning className="w-5 h-5 text-purple-600" weight="duotone" />
            Testimony Gaps ({session?.gaps.length || 0})
          </h3>
          {session?.gaps && session.gaps.length > 0 ? (
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {session.gaps.map(gap => (
                <div key={gap.id} className="border-l-4 border-purple-400 pl-4 py-2">
                  <div className="flex items-start justify-between">
                    <p className="text-foreground font-medium">{gap.description}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadgeClass(gap.severity)}`}>
                      {gap.severity}
                    </span>
                  </div>
                  {gap.documentReferences.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">References: {gap.documentReferences.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No significant gaps identified</p>
          )}
        </div>

        {/* Contradictions */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <WarningCircle className="w-5 h-5 text-red-600" weight="duotone" />
            Contradictions ({session?.contradictions.length || 0})
          </h3>
          {session?.contradictions && session.contradictions.length > 0 ? (
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {session.contradictions.map(contradiction => (
                <div key={contradiction.id} className="border-l-4 border-red-400 pl-4 py-2">
                  <div className="flex items-start justify-between">
                    <p className="text-foreground font-medium">{contradiction.description}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadgeClass(contradiction.severity)}`}>
                      {contradiction.severity}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    <p><strong>Source 1:</strong> {contradiction.source1.document} - &quot;{contradiction.source1.excerpt}&quot;</p>
                    <p><strong>Source 2:</strong> {contradiction.source2.document} - &quot;{contradiction.source2.excerpt}&quot;</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No contradictions detected</p>
          )}
        </div>
      </div>

      {/* Timeline Events */}
      {session?.analysis?.timelineEvents && session.analysis.timelineEvents.length > 0 && (
        <div className="mt-6 bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" weight="duotone" />
            Timeline of Events
          </h3>
          <div className="space-y-3">
            {session.analysis.timelineEvents.map((event, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-24 text-sm font-medium text-blue-600">{event.date}</div>
                <div className="flex-1">
                  <p className="text-foreground">{event.event}</p>
                  <p className="text-xs text-muted-foreground">Source: {event.source}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    );
  };

  // Render questions step
  const renderQuestions = () => (
    <div className="max-w-6xl mx-auto">
      {/* Usage meters */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <UsageMeter label="Session Cost" used={priceUsed} limit={DEMO_LIMITS.pricing.sessionPriceLimit} isPriceFormat />
        <UsageMeter label="Documents" used={session?.documents.length || 0} limit={DEMO_LIMITS.documents.maxDocumentsPerSession} />
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deposition Questions</h1>
          <p className="text-muted-foreground">
            {filteredQuestions.length} of {session?.questions.length} questions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentStep('analysis')}
            className="py-2 px-4 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition flex items-center gap-2"
          >
            <MagnifyingGlass className="w-5 h-5" weight="duotone" />
            View Analysis
          </button>
          <button
            onClick={autoOrganizeOutline}
            disabled={isOrganizingOutline}
            className="py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:bg-muted transition flex items-center gap-2"
          >
            {isOrganizingOutline ? <SpinnerGap className="w-5 h-5 animate-spin" /> : <List className="w-5 h-5" weight="duotone" />}
            Build Outline
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Filter by Topic</label>
          <select
            value={selectedTopic || ''}
            onChange={e => setSelectedTopic(e.target.value || null)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">All Topics</option>
            {uniqueTopics.map(topic => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Filter by Priority</label>
          <select
            value={selectedPriority || ''}
            onChange={e => setSelectedPriority(e.target.value || null)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-3">
        {filteredQuestions.map((question, index) => (
          <div key={question.id} className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition">
            <div className="p-4 cursor-pointer" onClick={() => toggleQuestionExpansion(question.id)}>
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-foreground font-medium mb-2">{question.question}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">{question.topic}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryBadgeClass(question.category)}`}>
                      {question.category.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadgeClass(question.priority)}`}>
                      {question.priority}
                    </span>
                    {question.documentReference && (
                      <span className="flex items-center gap-1 text-xs text-blue-600">
                        <FileText className="w-3 h-3" />
                        {question.documentReference}
                      </span>
                    )}
                  </div>
                </div>
                <button className="p-1 text-muted-foreground hover:text-foreground">
                  {expandedQuestions.has(question.id) ? <CaretUp className="w-5 h-5" /> : <CaretDown className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {expandedQuestions.has(question.id) && (
              <div className="px-4 pb-4 pt-0 border-t border-border bg-muted/50">
                {question.rationale && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Rationale</p>
                    <p className="text-sm text-foreground">{question.rationale}</p>
                  </div>
                )}
                {question.followUpQuestions && question.followUpQuestions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Follow-up Questions</p>
                    <ul className="text-sm text-foreground space-y-1">
                      {question.followUpQuestions.map((fq, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">→</span>
                          {fq}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Render outline step
  const renderOutline = () => (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deposition Outline</h1>
          <p className="text-muted-foreground">
            {session?.outline?.sections.length || 0} sections • {session?.questions.length || 0} questions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentStep('questions')}
            className="py-2 px-4 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition flex items-center gap-2"
          >
            <ChatCircle className="w-5 h-5" weight="duotone" />
            View All Questions
          </button>
          <button
            className="py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition flex items-center gap-2"
            onClick={exportToPDF}
          >
            <DownloadSimple className="w-5 h-5" />
            Export to PDF
          </button>
        </div>
      </div>

      {/* Outline sections */}
      {session?.outline?.sections && session.outline.sections.length > 0 ? (
        <div className="space-y-4">
          {session.outline.sections.map((section, sectionIndex) => (
            <div key={section.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/50 px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {sectionIndex + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-foreground">{section.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {section.questions.length} questions
                        {section.estimatedTime && ` • ~${section.estimatedTime} min`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-border">
                {section.questions.map((question, qIndex) => (
                  <div key={question.id} className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {qIndex + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-foreground">{question.question}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryBadgeClass(question.category)}`}>
                            {question.category.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadgeClass(question.priority)}`}>
                            {question.priority}
                          </span>
                          {question.documentReference && (
                            <span className="text-xs text-blue-600 flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {question.documentReference}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <List className="w-12 h-12 text-muted-foreground mx-auto mb-4" weight="duotone" />
          <p className="text-muted-foreground mb-4">No outline created yet</p>
          <button
            onClick={autoOrganizeOutline}
            disabled={isOrganizingOutline}
            className="py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:bg-muted transition"
          >
            {isOrganizingOutline ? 'Organizing...' : 'Auto-Organize Questions'}
          </button>
        </div>
      )}

      {/* Export tip */}
      <div className="mt-6 bg-primary/10 rounded-lg p-4 border border-primary/20">
        <div className="flex gap-3">
          <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" weight="fill" />
          <div>
            <p className="font-medium text-foreground">Ready for the deposition?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Export your outline to PDF with document citations. Each question will include
              references to the source documents, priority indicators, and follow-up questions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="py-8 px-4">
      <ErrorBanner />

      {/* Navigation */}
      {session && currentStep !== 'setup' && (
        <nav className="max-w-6xl mx-auto mb-6">
          <div className="flex items-center justify-between bg-card rounded-lg border border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" weight="duotone" />
              <span className="font-medium text-foreground">{session.caseName}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{session.deponentName}</span>
            </div>
            <div className="flex items-center gap-6">
              {(['documents', 'analysis', 'questions', 'outline'] as AppStep[]).map((step, index) => {
                const steps: AppStep[] = ['documents', 'analysis', 'questions', 'outline'];
                const currentIndex = steps.indexOf(currentStep);
                const stepIndex = index;
                const isActive = currentStep === step;
                const isCompleted = stepIndex < currentIndex;
                // Analysis is only accessible if gaps/contradictions exist (analysis has been generated)
                const hasAnalysis = (session.gaps && session.gaps.length > 0) || (session.contradictions && session.contradictions.length > 0);
                const isAccessible = stepIndex <= currentIndex || (step === 'analysis' && hasAnalysis) || (step === 'questions' && session.questions.length > 0) || (step === 'outline' && session.outline);

                return (
                  <button
                    key={step}
                    onClick={() => isAccessible && setCurrentStep(step)}
                    disabled={!isAccessible}
                    className={`flex items-center gap-2 text-sm font-medium transition ${
                      isActive
                        ? 'text-primary'
                        : isCompleted || isAccessible
                        ? 'text-muted-foreground hover:text-foreground cursor-pointer'
                        : 'text-muted-foreground/50 cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isCompleted
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? <CheckCircle className="w-4 h-4" weight="fill" /> : index + 1}
                    </span>
                    <span className="capitalize hidden sm:inline">{step}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to end this session?')) {
                  resetToSetup();
                }
              }}
              className="p-2 text-muted-foreground hover:text-foreground transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </nav>
      )}

      {/* Main content */}
      {currentStep === 'setup' && renderSetup()}
      {currentStep === 'documents' && renderDocuments()}
      {currentStep === 'analysis' && renderAnalysis()}
      {currentStep === 'questions' && renderQuestions()}
      {currentStep === 'outline' && renderOutline()}
    </div>
  );
}
