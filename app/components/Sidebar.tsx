'use client';

import { TabType } from '@/app/lib/types';
import {
    LayoutDashboard,
    Upload,
    History,
    Dumbbell,
    Activity,
    BookOpen,
    GitCompareArrows,
    MessageCircle,
    BarChart3,
    Bell,
} from 'lucide-react';

interface SidebarProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    recordCount: number;
    isOpen: boolean;
    onClose: () => void;
}

const navItems: { id: TabType; label: string; icon: React.ReactNode; }[] = [
    { id: 'dashboard', label: '대시보드', icon: <LayoutDashboard size={20} /> },
    { id: 'upload', label: '결과지 업로드', icon: <Upload size={20} /> },
    { id: 'history', label: '분석 기록', icon: <History size={20} /> },
    { id: 'compare', label: '비교 분석', icon: <GitCompareArrows size={20} /> },
    { id: 'weekly-report', label: '주간 리포트', icon: <BarChart3 size={20} /> },
    { id: 'workout-diary', label: '운동 일지', icon: <Dumbbell size={20} /> },
    { id: 'food-diary', label: '식단 일지', icon: <BookOpen size={20} /> },
    { id: 'notifications', label: '알림 설정', icon: <Bell size={20} /> },
    { id: 'chat', label: 'AI 코치', icon: <MessageCircle size={20} /> },
];

export default function Sidebar({ activeTab, onTabChange, recordCount, isOpen, onClose }: SidebarProps) {
    return (
        <>
            <div className={`mobile-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">
                            <Activity size={22} color="white" />
                        </div>
                        <div className="sidebar-logo-text">
                            <h1>HealthLens AI</h1>
                            <span>건강 지표 분석 대시보드</span>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <div
                            key={item.id}
                            className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => { onTabChange(item.id); onClose(); }}
                        >
                            <span className="sidebar-nav-icon">{item.icon}</span>
                            {item.label}
                            {item.id === 'history' && recordCount > 0 && (
                                <span className="tab-badge">{recordCount}</span>
                            )}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-footer-info">
                        <div className="sidebar-footer-avatar">👤</div>
                        <div className="sidebar-footer-text">
                            <span>내 건강 프로필</span>
                            <span>{recordCount}개 분석 기록</span>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
