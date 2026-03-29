'use client';

import React, { useEffect } from 'react';
import Header from './components/Header';
import ProjectListPanel from './components/ProjectListPanel';
import ApiConfigPanel from './components/ApiConfigPanel';
import SystemPromptEditor from './components/SystemPromptEditor';
import MessageList from './components/MessageList';
import { useEditor } from './contexts/EditorContext';
import { PlusCircle, Bot } from 'lucide-react';

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
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <Header />

      <div className="flex-1 relative flex overflow-hidden">
        <ProjectListPanel />
        <ApiConfigPanel />

        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {!currentProject ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
              <p className="text-xl mb-4">欢迎使用 AI Context Editor</p>
              <p>请从左侧列表选择一个项目或创建新项目开始</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full flex flex-col">
              <SystemPromptEditor />

              <div className="flex-1 flex flex-col w-full">
                <MessageList />
              </div>

              {/* Bottom Toolbar */}
              <div className="flex items-center justify-between py-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex space-x-3">
                  <button
                    onClick={() => addMessage('user')}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded-md transition-colors font-medium"
                  >
                    <PlusCircle size={18} />
                    <span>添加 User 消息</span>
                  </button>
                  <button
                    onClick={() => addMessage('assistant')}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 rounded-md transition-colors font-medium"
                  >
                    <PlusCircle size={18} />
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
