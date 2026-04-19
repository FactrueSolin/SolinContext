'use client';

import React, { useEffect } from 'react';
import { User, Bot } from 'lucide-react';
import Header from '../components/Header';
import ProjectListPanel from '../components/ProjectListPanel';
import ApiConfigPanel from '../components/ApiConfigPanel';
import SystemPromptEditor from '../components/SystemPromptEditor';
import MessageList from '../components/MessageList';
import { useEditor } from '../contexts/EditorContext';

export default function EditorWorkspace() {
  const {
    state: { currentProject },
    loadProjects,
    addMessage,
  } = useEditor();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <Header />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <ProjectListPanel />
        <ApiConfigPanel />

        <main className="flex h-full flex-1 flex-col overflow-hidden">
          {!currentProject ? (
            <div className="flex flex-1 flex-col items-center justify-center text-[var(--muted-foreground)]">
              <div className="flex flex-col items-center gap-4 p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
                  <Bot size={32} className="text-[var(--primary)]" />
                </div>
                <div className="text-center">
                  <p className="mb-2 text-xl font-semibold text-[var(--foreground)]">欢迎使用 AI Context Editor</p>
                  <p className="text-sm">请从左侧列表选择一个项目或创建新项目开始</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
              <SystemPromptEditor />

              <div className="flex w-full flex-1 flex-col">
                <MessageList />
              </div>

              <div className="mt-4 border-t border-[var(--border)] bg-[var(--background)] px-4 py-3 md:px-6 lg:px-8">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => addMessage('user')}
                    className="flex items-center gap-2 rounded-[var(--radius-md)] border border-transparent bg-[var(--primary-light)] px-4 py-2.5 text-sm font-medium text-[var(--primary)] transition-all duration-[var(--transition-fast)] hover:border-[var(--user-border)] hover:bg-blue-100 active:scale-[0.98] dark:hover:bg-blue-900/30"
                  >
                    <User size={16} />
                    <span>添加 User 消息</span>
                  </button>
                  <button
                    onClick={() => addMessage('assistant')}
                    className="flex items-center gap-2 rounded-[var(--radius-md)] border border-transparent bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 transition-all duration-[var(--transition-fast)] hover:border-[var(--assistant-border)] hover:bg-green-100 active:scale-[0.98] dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                  >
                    <Bot size={16} />
                    <span>添加 Assistant 消息</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
