"use client";

import { useState } from "react";
import { Scales, Gavel, ArrowRight, Lightning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import TestimonyPrepTool from "@/components/testimony/TestimonyPrepTool";
import { DepositionPrepTool } from "@/components/deposition";

type Tool = "none" | "testimony" | "deposition";

export default function Page() {
  const [selectedTool, setSelectedTool] = useState<Tool>("none");

  // Show selected tool
  if (selectedTool === "testimony") {
    return (
      <div className="flex-1 bg-background">
        <div className="border-b border-border bg-card px-6 py-4">
          <Button
            onClick={() => setSelectedTool("none")}
            variant="outline"
            size="lg"
            className="font-medium"
          >
            <ArrowRight className="size-5 rotate-180" />
            Back to tools
          </Button>
        </div>
        <TestimonyPrepTool />
      </div>
    );
  }

  if (selectedTool === "deposition") {
    return (
      <div className="flex-1 bg-background">
        <div className="border-b border-border bg-card px-6 py-4">
          <Button
            onClick={() => setSelectedTool("none")}
            variant="outline"
            size="lg"
            className="font-medium"
          >
            <ArrowRight className="size-5 rotate-180" />
            Back to tools
          </Button>
        </div>
        <DepositionPrepTool />
      </div>
    );
  }

  // Tool selector
  return (
    <main className="flex-1 flex flex-col items-center justify-center bg-background px-6 py-12">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-medium dark:bg-amber-900/30 dark:text-amber-200">
                <Lightning weight="fill" className="size-4" />
                Demo Preview
              </div>
              <a
                href="https://case.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                <span>built with</span>
                <svg width="14" height="14" viewBox="0 0 144 144" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M127.927 56.3865C127.927 54.7298 126.583 53.3867 124.927 53.3865H19.6143C17.9574 53.3865 16.6143 54.7296 16.6143 56.3865V128.226C16.6143 129.883 17.9574 131.226 19.6143 131.226H124.927C126.583 131.226 127.927 129.883 127.927 128.226V56.3865ZM93.1553 32.6638C93.1553 31.007 91.8121 29.6639 90.1553 29.6638H53.4102C51.7534 29.664 50.4102 31.0071 50.4102 32.6638V47.3865H93.1553V32.6638ZM99.1553 47.3865H124.927C129.897 47.3867 133.927 51.4161 133.927 56.3865V128.226C133.927 133.197 129.897 137.226 124.927 137.226H19.6143C14.6437 137.226 10.6143 133.197 10.6143 128.226V56.3865C10.6143 51.4159 14.6437 47.3865 19.6143 47.3865H44.4102V32.6638C44.4102 27.6933 48.4397 23.664 53.4102 23.6638H90.1553C95.1258 23.6639 99.1553 27.6933 99.1553 32.6638V47.3865Z" fill="#EB5600"/>
                  <path d="M76.6382 70.6082C77.8098 69.4366 79.7088 69.4366 80.8804 70.6082L98.8013 88.5291C100.754 90.4817 100.754 93.6477 98.8013 95.6003L80.8804 113.521C79.7088 114.693 77.8097 114.693 76.6382 113.521C75.4667 112.35 75.4667 110.451 76.6382 109.279L93.8521 92.0642L76.6382 74.8503C75.4666 73.6788 75.4666 71.7797 76.6382 70.6082Z" fill="#EB5600"/>
                  <path d="M67.3618 70.6082C66.1902 69.4366 64.2912 69.4366 63.1196 70.6082L45.1987 88.5291C43.2461 90.4817 43.2461 93.6477 45.1987 95.6003L63.1196 113.521C64.2912 114.693 66.1903 114.693 67.3618 113.521C68.5333 112.35 68.5333 110.451 67.3618 109.279L50.1479 92.0642L67.3618 74.8503C68.5334 73.6788 68.5334 71.7797 67.3618 70.6082Z" fill="#EB5600"/>
                </svg>
                <span className="font-semibold">case.dev</span>
              </a>
            </div>
            <h1
              className="text-4xl md:text-5xl font-light tracking-tight text-foreground mb-4"
              style={{ fontFamily: "'Spectral', serif" }}
            >
              Deposition Prep Tools
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              AI-powered tools for witness testimony preparation and deposition planning.
            </p>
          </div>

          {/* Tool Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Testimony Prep Tool */}
            <button
              onClick={() => setSelectedTool("testimony")}
              className="group text-left rounded-xl border border-border bg-card p-6 hover:border-primary hover:shadow-lg transition-all"
            >
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Scales className="size-6 text-primary" weight="duotone" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                  Testimony Prep Tool
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Prepare witnesses for cross-examination with AI-generated questions based on case documents.
                  Practice with an AI examiner that provides real-time feedback.
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Upload case documents (PDF, DOCX, TXT)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Generate 20 cross-examination questions
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Interactive practice with AI feedback
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-end">
              <span className="text-primary text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                Start
                <ArrowRight className="size-4" />
              </span>
            </div>
          </button>

          {/* Deposition Prep Tool */}
          <button
            onClick={() => setSelectedTool("deposition")}
            className="group text-left rounded-xl border border-border bg-card p-6 hover:border-primary hover:shadow-lg transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Gavel className="size-6 text-primary" weight="duotone" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                  Deposition Prep Tool
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Strategic deposition planning with document analysis, gap identification, and
                  question outline generation.
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Analyze prior testimony for contradictions
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Identify testimony gaps
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Generate strategic question outlines
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-end">
              <span className="text-primary text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                Start
                <ArrowRight className="size-4" />
              </span>
            </div>
          </button>
        </div>

          {/* Footer info */}
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              This is a demo with usage limits.{" "}
              <a
                href="https://case.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Contact Case.dev
              </a>{" "}
              for unlimited access and custom integrations.
            </p>
          </div>
        </div>
    </main>
  );
}
