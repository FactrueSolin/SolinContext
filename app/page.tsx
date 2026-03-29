'use client';

import React, { useEffect } from 'react';
import Header from './components/Header';
import ProjectListPanel from './components/ProjectListPanel';
import ApiConfigPanel from './components/ApiConfigPanel';
import SystemPromptEditor from './components/SystemPromptEditor';
import MessageList from './components/MessageList';
import { useEditor } from './contexts/EditorContext';
import { PlusCircle, User, Bot } from 'lucide-react';

export default function Home() {
  const {
    state: { currentProject },
    loadProjects,
    addMessage,
  } = useEditor();

  // Load projects on initial mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <Header />

      <div className="flex-1 relative flex overflow-hidden">
        <ProjectListPanel />
        <ApiConfigPanel />

        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {!currentProject ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)]">
              <div className="flex flex-col items-center gap-4 p-8">
                <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
                  <Bot size={32} className="text-[var(--primary)]" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-semibold text-[var(--foreground)] mb-2">欢迎使用 AI Context Editor</p>
                  <p className="text-sm">请从左侧列表选择一个项目或创建新项目开始</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8 max-w-4xl mx-auto w-full flex flex-col">
              <SystemPromptEditor />

              <div className="flex-1 flex flex-col w-full">
                <MessageList />
              </div>

              {/* Bottom Toolbar - 正常流式布局，紧跟消息列表 */}
              <div className="bg-[var(--background)] border-t border-[var(--border)] px-4 md:px-6 lg:px-8 py-3 mt-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => addMessage('user')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary-light)] text-[var(--primary)] hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-[var(--radius-md)] transition-all duration-[var(--transition-fast)] font-medium text-sm border border-transparent hover:border-[var(--user-border)] active:scale-[0.98]"
                  >
                    <User size={16} />
                    <span>添加 User 消息</span>
                  </button>
                  <button
                    onClick={() => addMessage('assistant')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-[var(--radius-md)] transition-all duration-[var(--transition-fast)] font-medium text-sm border border-transparent hover:border-[var(--assistant-border)] active:scale-[0.98]"
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
