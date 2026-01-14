'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Scales,
  Upload,
  FileText,
  ChatCircle,
  Play,
  Clock,
  Warning,
  CheckCircle,
  CaretRight,
  SpinnerGap,
  Microphone,
  MicrophoneSlash,
  X,
  Lightbulb,
  Target,
  Shield,
  WarningCircle,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UsageMeter } from '@/components/demo/UsageMeter';
import { LimitWarning } from '@/components/demo/LimitWarning';
import { DEMO_LIMITS } from '@/lib/demo-limits/config';
import {
  createSession,
  getSession,
  updateSession,
  addDocument,
  setQuestions,
  addPracticeExchange,
  deleteSession,
} from '@/lib/storage/session-storage';
import {
  getSessionStats,
  incrementSessionPrice,
  formatPrice,
} from '@/lib/storage/usage-storage';
import type {
  PracticeSession,
  Document,
  CrossExamQuestion,
  AIExaminerResponse,
} from '@/lib/types/testimony';
import { processDocument } from '@/lib/document-processor';

type AppStep = 'setup' | 'documents' | 'questions' | 'practice' | 'review';

export default function TestimonyPrepTool() {
  // Session state
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [currentStep, setCurrentStep] = useState<AppStep>('setup');

  // Form state
  const [witnessName, setWitnessName] = useState('');
  const [caseName, setCaseName] = useState('');

  // Loading states
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  // Error and limit state
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState<'priceLimit' | 'documentLimit' | null>(null);

  // Usage tracking
  const [priceUsed, setPriceUsed] = useState(0);
  const [documentsUsed, setDocumentsUsed] = useState(0);

  // Practice state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [witnessResponse, setWitnessResponse] = useState('');
  const [lastAIResponse, setLastAIResponse] = useState<AIExaminerResponse | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Timer state
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Load session stats on mount
  useEffect(() => {
    const stats = getSessionStats();
    setPriceUsed(stats.sessionPrice);
    setDocumentsUsed(stats.documentsUploaded);
  }, []);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (currentStep === 'practice' && sessionStartTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStep, sessionStartTime]);

  // Show error with auto-dismiss
  const showError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 10000);
  }, []);

  // Reset to setup
  const resetToSetup = useCallback(() => {
    if (session) {
      deleteSession(session.id);
    }
    setSession(null);
    setCurrentStep('setup');
    setWitnessName('');
    setCaseName('');
    setCurrentQuestionIndex(0);
    setWitnessResponse('');
    setLastAIResponse(null);
    setShowFeedback(false);
    setError(null);
    setLimitReached(null);
    // Don't reset priceUsed/documentsUsed - they persist across testimony sessions
    // Reload from session stats instead
    const stats = getSessionStats();
    setPriceUsed(stats.sessionPrice);
    setDocumentsUsed(stats.documentsUploaded);
  }, [session]);

  // Create session
  const handleCreateSession = useCallback(async () => {
    if (!witnessName.trim() || !caseName.trim()) return;

    setIsCreatingSession(true);
    setError(null);

    try {
      const newSession = createSession(witnessName.trim(), caseName.trim());
      setSession(newSession);
      setCurrentStep('documents');
    } catch (err) {
      console.error('Error creating session:', err);
      showError('Failed to create session. Please try again.');
    } finally {
      setIsCreatingSession(false);
    }
  }, [witnessName, caseName, showError]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || !session) return;

      // Check document limit
      if (session.documents.length >= DEMO_LIMITS.documents.maxDocumentsPerSession) {
        setLimitReached('documentLimit');
        return;
      }

      setIsUploadingDocument(true);
      setError(null);

      for (const file of Array.from(files)) {
        // Check file size
        if (file.size > DEMO_LIMITS.documents.maxFileSize) {
          showError(`File "${file.name}" exceeds ${DEMO_LIMITS.documents.maxFileSize / (1024 * 1024)}MB limit`);
          continue;
        }

        const docId = uuidv4();
        const doc: Document = {
          id: docId,
          name: file.name,
          type: file.type || 'unknown',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          status: 'processing',
        };

        // Add document with processing status
        let updatedSession = addDocument(session.id, doc);
        if (updatedSession) setSession(updatedSession);

        try {
          let content = '';
          let pageCount = 1;

          // Extract text using client-side document processor
          const result = await processDocument(file);
          content = result.text;
          pageCount = result.pageCount;

          // Send to server for cost calculation
          const response = await fetch('/api/testimony/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: content,
              pageCount,
              fileName: file.name,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to process document');
          }

          // Track cost
          if (data.cost) {
            incrementSessionPrice(data.cost);
            setPriceUsed((prev) => prev + data.cost);
          }

          // Update document with content
          const currentSession = getSession(session.id);
          if (currentSession) {
            const updatedDocs = currentSession.documents.map((d) =>
              d.id === docId ? { ...d, content, status: 'ready' as const } : d
            );
            updatedSession = updateSession(session.id, { documents: updatedDocs });
            if (updatedSession) setSession(updatedSession);
          }
        } catch (err) {
          console.error('Error processing document:', err);
          const errorMessage = err instanceof Error ? err.message : 'Failed to process document';
          showError(`${file.name}: ${errorMessage}`);

          // Update doc status to error
          const currentSession = getSession(session.id);
          if (currentSession) {
            const updatedDocs = currentSession.documents.map((d) =>
              d.id === docId ? { ...d, status: 'error' as const } : d
            );
            updatedSession = updateSession(session.id, { documents: updatedDocs });
            if (updatedSession) setSession(updatedSession);
          }
        }
      }

      setIsUploadingDocument(false);
    },
    [session, showError]
  );

  // Generate questions
  const handleGenerateQuestions = useCallback(async () => {
    if (!session || session.documents.length === 0) return;

    setIsGeneratingQuestions(true);
    setError(null);

    try {
      const response = await fetch('/api/testimony/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          witnessName: session.witnessName,
          caseName: session.caseName,
          documents: session.documents.map((d) => ({
            name: d.name,
            content: d.content || '',
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.limitReached) {
          setLimitReached('priceLimit');
          return;
        }
        throw new Error(data.error || 'Failed to generate questions');
      }

      if (data.cost) {
        incrementSessionPrice(data.cost);
        setPriceUsed((prev) => prev + data.cost);
      }

      if (data.questions && data.questions.length > 0) {
        const updatedSession = setQuestions(session.id, data.questions);
        if (updatedSession) {
          setSession(updatedSession);
          setCurrentStep('questions');
        }
      } else {
        showError('No questions generated. Please try again.');
      }
    } catch (err) {
      console.error('Error generating questions:', err);
      showError('Failed to generate questions. Please try again.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  }, [session, showError]);

  // Start practice
  const startPractice = useCallback(() => {
    setCurrentStep('practice');
    setCurrentQuestionIndex(0);
    setSessionStartTime(new Date());
    setQuestionStartTime(new Date());
    setError(null);
  }, []);

  // Submit response
  const submitResponse = useCallback(async () => {
    if (!session || !witnessResponse.trim()) return;

    const currentQuestion = session.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setIsSubmittingResponse(true);
    setShowFeedback(false);
    setError(null);

    const duration = questionStartTime
      ? Math.floor((new Date().getTime() - questionStartTime.getTime()) / 1000)
      : 0;

    try {
      const response = await fetch('/api/testimony/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          witnessName: session.witnessName,
          caseName: session.caseName,
          documents: session.documents.map((d) => ({
            name: d.name,
            content: d.content || '',
          })),
          questionId: currentQuestion.id,
          question: currentQuestion.question,
          witnessResponse: witnessResponse,
          duration,
          questionDetails: {
            suggestedApproach: currentQuestion.suggestedApproach,
            weakPoint: currentQuestion.weakPoint,
            documentReference: currentQuestion.documentReference,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.limitReached) {
          setLimitReached('priceLimit');
          return;
        }
        throw new Error(data.error || 'Failed to analyze response');
      }

      if (data.cost) {
        incrementSessionPrice(data.cost);
        setPriceUsed((prev) => prev + data.cost);
      }

      // Add practice exchange to session
      const exchange = {
        id: uuidv4(),
        questionId: currentQuestion.id,
        question: currentQuestion.question,
        witnessResponse,
        aiFollowUp: data.aiResponse?.followUp,
        feedback: data.aiResponse?.feedback,
        timestamp: new Date().toISOString(),
        duration,
      };

      const updatedSession = addPracticeExchange(session.id, exchange);
      if (updatedSession) setSession(updatedSession);

      if (data.aiResponse) {
        setLastAIResponse(data.aiResponse);
        setShowFeedback(true);
      }
    } catch (err) {
      console.error('Error submitting response:', err);
      showError('Failed to analyze response. Please try again.');
    } finally {
      setIsSubmittingResponse(false);
    }
  }, [session, currentQuestionIndex, witnessResponse, questionStartTime, showError]);

  // Next question
  const nextQuestion = useCallback(() => {
    if (!session) return;

    if (currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setWitnessResponse('');
      setLastAIResponse(null);
      setShowFeedback(false);
      setQuestionStartTime(new Date());
    } else {
      setCurrentStep('review');
    }
  }, [session, currentQuestionIndex]);

  // Toggle recording (placeholder)
  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get category style
  const getCategoryStyle = (category: CrossExamQuestion['category']) => {
    const styles: Record<CrossExamQuestion['category'], string> = {
      timeline: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      credibility: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      inconsistency: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      foundation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      impeachment: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      general: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    };
    return styles[category];
  };

  // Get difficulty style
  const getDifficultyStyle = (difficulty: CrossExamQuestion['difficulty']) => {
    const styles: Record<CrossExamQuestion['difficulty'], string> = {
      easy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    return styles[difficulty];
  };

  // Error banner component
  const ErrorBanner = () => {
    if (!error) return null;
    return (
      <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-in slide-in-from-top">
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 shadow-lg">
          <WarningCircle className="size-5 shrink-0 text-destructive" weight="fill" />
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => setError(null)} className="text-destructive hover:text-destructive/80">
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  };

  // Render setup step
  const renderSetup = () => (
    <div className="mx-auto max-w-2xl animate-in fade-in">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Scales className="size-8 text-primary" weight="duotone" />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">Testimony Prep Tool</h1>
        <p className="text-muted-foreground">
          Prepare witnesses for cross-examination with AI-generated questions and practice sessions
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <h2 className="mb-6 text-xl font-semibold">Start a New Session</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Witness Name</label>
            <input
              type="text"
              value={witnessName}
              onChange={(e) => setWitnessName(e.target.value)}
              placeholder="e.g., Dr. Sarah Johnson"
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Case Name</label>
            <input
              type="text"
              value={caseName}
              onChange={(e) => setCaseName(e.target.value)}
              placeholder="e.g., Smith v. Memorial Hospital"
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <Button
            onClick={handleCreateSession}
            disabled={!witnessName.trim() || !caseName.trim() || isCreatingSession}
            className="w-full"
            size="lg"
          >
            {isCreatingSession ? (
              <>
                <SpinnerGap className="size-5 animate-spin" />
                Creating Session...
              </>
            ) : (
              <>
                Start Session
                <CaretRight className="size-5" data-icon="inline-end" />
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Upload className="mx-auto mb-2 size-6 text-primary" weight="duotone" />
          <p className="text-sm text-muted-foreground">Upload case documents</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <ChatCircle className="mx-auto mb-2 size-6 text-primary" weight="duotone" />
          <p className="text-sm text-muted-foreground">Generate questions</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Play className="mx-auto mb-2 size-6 text-primary" weight="duotone" />
          <p className="text-sm text-muted-foreground">Practice with AI</p>
        </div>
      </div>

      {/* Usage info */}
      <div className="mt-6 space-y-3">
        <UsageMeter
          label="Session Cost"
          used={priceUsed}
          limit={DEMO_LIMITS.pricing.sessionPriceLimit}
          isPriceFormat
        />
        <UsageMeter
          label="Documents"
          used={documentsUsed}
          limit={DEMO_LIMITS.documents.maxDocumentsPerSession}
        />
      </div>
    </div>
  );

  // Render generating questions loading screen
  const renderGeneratingQuestions = () => (
    <div className="mx-auto max-w-2xl animate-in fade-in">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <div className="relative mb-6 inline-flex size-24 items-center justify-center">
            <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10"></div>
            <Scales className="relative z-10 size-12 animate-bounce text-primary" weight="duotone" />
          </div>

          <h2 className="mb-2 text-2xl font-bold text-foreground">Generating Cross-Examination Questions</h2>
          <p className="mb-6 text-muted-foreground">
            Our AI is analyzing your documents and crafting challenging questions...
          </p>

          <div className="mx-auto mb-6 max-w-md space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex size-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="size-4 text-green-600 dark:text-green-400" weight="fill" />
              </div>
              <span className="text-foreground">Documents uploaded ({session?.documents.length} files)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex size-6 items-center justify-center rounded-full bg-primary/10">
                <SpinnerGap className="size-4 animate-spin text-primary" />
              </div>
              <span className="text-foreground">Analyzing document content...</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex size-6 items-center justify-center rounded-full bg-muted">
                <div className="size-2 rounded-full bg-muted-foreground"></div>
              </div>
              <span className="text-muted-foreground">Generating questions</span>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full animate-pulse rounded-full bg-primary" style={{ width: '60%' }}></div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            This typically takes 30-60 seconds depending on document complexity
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
        <div className="flex gap-3">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" weight="fill" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">While you wait...</p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              The AI is identifying potential weak points in the testimony, timeline inconsistencies, and areas where
              opposing counsel might challenge credibility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Render documents step
  const renderDocuments = () => {
    if (isGeneratingQuestions) {
      return renderGeneratingQuestions();
    }

    if (limitReached) {
      return (
        <div className="mx-auto max-w-2xl">
          <LimitWarning type={limitReached} onUpgrade={() => window.open('https://case.dev', '_blank')} />
          <Button onClick={() => setLimitReached(null)} variant="outline" className="mt-4">
            Go Back
          </Button>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-4xl animate-in fade-in">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Upload Case Materials</h1>
            <p className="text-muted-foreground">
              {session?.caseName} - Witness: {session?.witnessName}
            </p>
          </div>
          <Button
            onClick={handleGenerateQuestions}
            disabled={!session?.documents.some((d) => d.status === 'ready') || isGeneratingQuestions}
          >
            Generate Questions
            <CaretRight className="size-5" data-icon="inline-end" />
          </Button>
        </div>

        {/* Upload area */}
        <div
          className="cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition hover:border-primary"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileUpload(e.dataTransfer.files);
          }}
          onClick={() => document.getElementById('testimony-file-input')?.click()}
        >
          <input
            id="testimony-file-input"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />

          {isUploadingDocument ? (
            <div className="flex flex-col items-center">
              <SpinnerGap className="mb-4 size-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Uploading document...</p>
            </div>
          ) : (
            <>
              <Upload className="mx-auto mb-4 size-12 text-muted-foreground" weight="duotone" />
              <p className="mb-1 text-lg font-medium text-foreground">Drop files here or click to upload</p>
              <p className="text-sm text-muted-foreground">Supports PDF, Word documents, and text files (max 5MB)</p>
            </>
          )}
        </div>

        {/* Document list */}
        {session?.documents && session.documents.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">Uploaded Documents ({session.documents.length})</h3>
            <div className="space-y-2">
              {session.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="size-5 text-primary" weight="duotone" />
                    <div>
                      <p className="font-medium text-foreground">{doc.name}</p>
                      <p className="text-sm text-muted-foreground">{(doc.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'rounded px-2 py-1 text-xs font-medium',
                      doc.status === 'ready'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : doc.status === 'error'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    )}
                  >
                    {doc.status === 'ready' ? 'Ready' : doc.status === 'error' ? 'Error' : 'Processing'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Usage meters */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <UsageMeter
            label="Documents This Session"
            used={session?.documents.length || 0}
            limit={DEMO_LIMITS.documents.maxDocumentsPerSession}
          />
          <UsageMeter
            label="Session Cost"
            used={priceUsed}
            limit={DEMO_LIMITS.pricing.sessionPriceLimit}
            isPriceFormat
          />
        </div>

        {/* Tips */}
        <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex gap-3">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" weight="fill" />
            <div>
              <p className="font-medium text-foreground">Tips for better questions</p>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                <li>- Upload text files (.txt) for best results - content is extracted and analyzed</li>
                <li>- Include depositions, witness statements, and relevant exhibits</li>
                <li>- The AI will generate questions based on specific details in your documents</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render questions step
  const renderQuestions = () => (
    <div className="mx-auto max-w-4xl animate-in fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cross-Examination Questions</h1>
          <p className="text-muted-foreground">
            {session?.questions.length} questions generated for {session?.witnessName}
          </p>
        </div>
        <Button onClick={startPractice}>
          <Play className="size-5" data-icon="inline-start" weight="fill" />
          Start Practice
        </Button>
      </div>

      {/* Category summary */}
      <div className="mb-6 grid grid-cols-6 gap-2">
        {(['timeline', 'credibility', 'inconsistency', 'foundation', 'impeachment', 'general'] as const).map((cat) => {
          const count = session?.questions.filter((q) => q.category === cat).length || 0;
          return (
            <div key={cat} className={cn('rounded-lg px-3 py-2 text-center', getCategoryStyle(cat))}>
              <p className="text-xs font-medium capitalize">{cat}</p>
              <p className="text-lg font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Questions list */}
      <div className="space-y-3">
        {session?.questions.map((question, index) => (
          <div key={question.id} className="rounded-lg border border-border bg-card p-4 transition hover:shadow-md">
            <div className="flex items-start gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="mb-2 font-medium text-foreground">{question.question}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded px-2 py-0.5 text-xs font-medium', getCategoryStyle(question.category))}>
                    {question.category}
                  </span>
                  <span className={cn('rounded px-2 py-0.5 text-xs font-medium', getDifficultyStyle(question.difficulty))}>
                    {question.difficulty}
                  </span>
                  {question.documentReference && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <FileText className="size-3" />
                      {question.documentReference}
                    </span>
                  )}
                  {question.weakPoint && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Warning className="size-3" />
                      {question.weakPoint}
                    </span>
                  )}
                </div>
                {question.suggestedApproach && (
                  <p className="mt-2 rounded bg-muted p-2 text-sm text-muted-foreground">
                    <strong>Suggested approach:</strong> {question.suggestedApproach}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render practice step
  const renderPractice = () => {
    const currentQuestion = session?.questions[currentQuestionIndex];
    const progress = session ? ((currentQuestionIndex + 1) / session.questions.length) * 100 : 0;

    if (limitReached) {
      return (
        <div className="mx-auto max-w-2xl">
          <LimitWarning type={limitReached} onUpgrade={() => window.open('https://case.dev', '_blank')} />
          <Button onClick={() => setLimitReached(null)} variant="outline" className="mt-4">
            Go Back
          </Button>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-4xl animate-in fade-in">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Practice Mode</h1>
            <p className="text-muted-foreground">
              Question {currentQuestionIndex + 1} of {session?.questions.length}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-5" />
              <span className="font-mono">{formatTime(elapsedTime)}</span>
            </div>
            <button
              onClick={toggleRecording}
              className={cn(
                'rounded-full p-2 transition',
                isRecording
                  ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? <MicrophoneSlash className="size-5" /> : <Microphone className="size-5" />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6 h-2 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Question card */}
        {currentQuestion && (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {/* Question header */}
            <div className="border-b border-border bg-muted/50 px-6 py-4">
              <div className="mb-2 flex items-center gap-2">
                <span className={cn('rounded px-2 py-0.5 text-xs font-medium', getCategoryStyle(currentQuestion.category))}>
                  {currentQuestion.category}
                </span>
                <span className={cn('rounded px-2 py-0.5 text-xs font-medium', getDifficultyStyle(currentQuestion.difficulty))}>
                  {currentQuestion.difficulty}
                </span>
                {currentQuestion.documentReference && (
                  <span className="flex items-center gap-1 text-xs text-primary">
                    <FileText className="size-3" />
                    {currentQuestion.documentReference}
                  </span>
                )}
              </div>
              <p className="text-lg font-medium text-foreground">{currentQuestion.question}</p>
            </div>

            {/* Response area */}
            <div className="p-6">
              <label className="mb-2 block text-sm font-medium text-foreground">Your Response</label>
              <textarea
                value={witnessResponse}
                onChange={(e) => setWitnessResponse(e.target.value)}
                placeholder="Type your response as the witness would answer..."
                rows={4}
                className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                disabled={showFeedback}
              />

              {!showFeedback && (
                <div className="mt-4 flex gap-3">
                  <Button onClick={nextQuestion} disabled={isSubmittingResponse} variant="outline">
                    Skip
                  </Button>
                  <Button
                    onClick={submitResponse}
                    disabled={!witnessResponse.trim() || isSubmittingResponse}
                    className="flex-1"
                  >
                    {isSubmittingResponse ? (
                      <>
                        <SpinnerGap className="size-5 animate-spin" />
                        Analyzing Response...
                      </>
                    ) : (
                      <>
                        Submit Response
                        <CaretRight className="size-5" data-icon="inline-end" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* AI Feedback */}
            {showFeedback && lastAIResponse && (
              <div className="animate-in slide-in-from-bottom border-t border-border bg-primary/5 p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                  <Target className="size-5 text-primary" weight="fill" />
                  AI Examiner Feedback
                </h3>

                {lastAIResponse.followUp && (
                  <div className="mb-4 rounded-lg border border-primary/30 bg-card p-4">
                    <p className="mb-1 text-sm font-medium text-primary">Follow-up Question:</p>
                    <p className="italic text-foreground">&ldquo;{lastAIResponse.followUp}&rdquo;</p>
                  </div>
                )}

                {lastAIResponse.feedback && (
                  <div className="mb-4">
                    <p className="mb-1 text-sm font-medium text-foreground">Feedback:</p>
                    <p className="text-muted-foreground">{lastAIResponse.feedback}</p>
                  </div>
                )}

                {lastAIResponse.weaknessIdentified && (
                  <div className="mb-4 flex items-start gap-2">
                    <Warning className="mt-0.5 size-5 shrink-0 text-amber-500" weight="fill" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Weakness Identified:</p>
                      <p className="text-muted-foreground">{lastAIResponse.weaknessIdentified}</p>
                    </div>
                  </div>
                )}

                {lastAIResponse.suggestedImprovement && (
                  <div className="mb-4 flex items-start gap-2">
                    <Shield className="mt-0.5 size-5 shrink-0 text-green-500" weight="fill" />
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Suggested Improvement:</p>
                      <p className="text-muted-foreground">{lastAIResponse.suggestedImprovement}</p>
                    </div>
                  </div>
                )}

                <Button onClick={nextQuestion} className="w-full">
                  {currentQuestionIndex < (session?.questions.length || 0) - 1 ? (
                    <>
                      Next Question
                      <CaretRight className="size-5" data-icon="inline-end" />
                    </>
                  ) : (
                    <>
                      Complete Session
                      <CheckCircle className="size-5" data-icon="inline-end" weight="fill" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Suggested approach hint */}
        {currentQuestion?.suggestedApproach && !showFeedback && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
            <div className="flex gap-3">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" weight="fill" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">Suggested Approach</p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{currentQuestion.suggestedApproach}</p>
              </div>
            </div>
          </div>
        )}

        {/* Usage meter */}
        <div className="mt-6">
          <UsageMeter
            label="Session Cost"
            used={priceUsed}
            limit={DEMO_LIMITS.pricing.sessionPriceLimit}
            isPriceFormat
          />
        </div>
      </div>
    );
  };

  // Render review step
  const renderReview = () => (
    <div className="mx-auto max-w-4xl animate-in fade-in">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle className="size-8 text-green-600 dark:text-green-400" weight="fill" />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">Session Complete!</h1>
        <p className="text-muted-foreground">Great work preparing {session?.witnessName} for cross-examination</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-3xl font-bold text-primary">{session?.practiceHistory.length}</p>
          <p className="text-muted-foreground">Questions Practiced</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-3xl font-bold text-primary">{formatTime(elapsedTime)}</p>
          <p className="text-muted-foreground">Total Time</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-3xl font-bold text-primary">{session?.documents.length}</p>
          <p className="text-muted-foreground">Documents Reviewed</p>
        </div>
      </div>

      {/* Practice history */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/50 px-6 py-4">
          <h2 className="text-lg font-semibold">Practice History</h2>
        </div>
        <div className="max-h-96 divide-y divide-border overflow-y-auto">
          {session?.practiceHistory.map((exchange, index) => (
            <div key={exchange.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="mb-1 font-medium text-foreground">{exchange.question}</p>
                  <p className="mb-2 text-sm text-muted-foreground">
                    <strong>Response:</strong> {exchange.witnessResponse}
                  </p>
                  {exchange.feedback && (
                    <p className="rounded bg-primary/5 p-2 text-sm text-primary">
                      <strong>Feedback:</strong> {exchange.feedback}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-4">
        <Button onClick={resetToSetup} variant="outline" className="flex-1">
          Start New Session
        </Button>
        <Button
          onClick={() => {
            setCurrentStep('practice');
            setCurrentQuestionIndex(0);
            setWitnessResponse('');
            setLastAIResponse(null);
            setShowFeedback(false);
          }}
          className="flex-1"
        >
          Practice Again
        </Button>
      </div>
    </div>
  );

  return (
    <div className="px-4 py-8">
      <ErrorBanner />

      {/* Navigation */}
      {session && currentStep !== 'setup' && (
        <nav className="mx-auto mb-6 max-w-6xl">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <Scales className="size-5 text-primary" weight="duotone" />
              <span className="font-medium text-foreground">{session.caseName}</span>
              <span className="text-muted-foreground">-</span>
              <span className="text-muted-foreground">{session.witnessName}</span>
            </div>
            <div className="flex items-center gap-6">
              {(['documents', 'questions', 'practice', 'review'] as AppStep[]).map((step, index) => {
                const steps: AppStep[] = ['documents', 'questions', 'practice', 'review'];
                const currentIndex = steps.indexOf(currentStep);
                const stepIndex = index;
                const isActive = currentStep === step;
                const isCompleted = stepIndex < currentIndex;

                return (
                  <button
                    key={step}
                    onClick={() => {
                      if (isCompleted || isActive) {
                        setCurrentStep(step);
                      }
                    }}
                    disabled={!isCompleted && !isActive}
                    className={cn(
                      'flex items-center gap-2 text-sm font-medium transition',
                      isActive
                        ? 'text-primary'
                        : isCompleted
                        ? 'cursor-pointer text-muted-foreground hover:text-foreground'
                        : 'cursor-not-allowed text-muted-foreground/50'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full text-xs',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isCompleted
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {isCompleted ? <CheckCircle className="size-4" weight="fill" /> : index + 1}
                    </span>
                    <span className="hidden capitalize sm:inline">{step}</span>
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
              className="p-2 text-muted-foreground transition hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </nav>
      )}

      {/* Main content */}
      {currentStep === 'setup' && renderSetup()}
      {currentStep === 'documents' && renderDocuments()}
      {currentStep === 'questions' && renderQuestions()}
      {currentStep === 'practice' && renderPractice()}
      {currentStep === 'review' && renderReview()}
    </div>
  );
}
