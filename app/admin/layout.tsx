'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../../components/ConfirmModal';
import { 
  Users, 
  BookOpen,
  Settings,
  Menu,
  X,
  LogOut,
  Calendar
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// ✅ Inner component to safely handle search params without crashing the layout
function TokenHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Save to sessionStorage
      sessionStorage.setItem('admin_token', token);
      // Clean the URL
      router.replace(pathname);
    }
  }, [searchParams, router, pathname]);

  return null;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Desktop: sidebar is expanded (280px) or collapsed (80px)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Mobile: drawer is closed by default, overlays content when opened
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    // Redirect to external portal URL
    window.location.href = process.env.NEXT_PUBLIC_LOGIN_PORTAL_URL || 'https://staging.sgs.swais.in';
  };

  const menuItems = [
    { id: 'teachers', name: 'Teachers', icon: BookOpen, path: '/admin/teachers', color: 'from-green-500 to-emerald-500' },
    { id: 'students', name: 'Students', icon: Users, path: '/admin/students', color: 'from-blue-500 to-cyan-500' },
    { id: 'timetable', name: 'Timetable', icon: Calendar, path: '/admin/timetable', color: 'from-orange-500 to-red-500' },
    { id: 'others', name: 'Others', icon: Settings, path: '/admin/others', color: 'from-purple-500 to-pink-500' },
  ];

  // Shared sidebar content
  const SidebarContent = ({ isMobile = false }) => {
    const isExpanded = isMobile ? true : sidebarOpen;
    return (
      <>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            {isExpanded && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center w-full"
              >
                <div className="w-20 h-20 relative rounded-full overflow-hidden border-2 border-yellow-400/40 shadow-lg shadow-yellow-500/20 bg-white/5">
                  <Image
                    src="/sgslogo.jpeg"
                    alt="SGS School Logo"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                <div className="text-center mt-2">
                  <h1 className="text-white font-bold text-xl">SGS High School</h1>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider">Admin Portal</p>
                </div>
              </motion.div>
            )}
            {!isExpanded && (
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <Menu size={24} />
              </button>
            )}
          </div>

          <nav className="space-y-2 mt-4">
            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link href={item.path} key={item.id}>
                  <motion.div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                      isActive 
                        ? `bg-gradient-to-r ${item.color} text-white shadow-lg` 
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                    whileHover={{ x: 5 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <item.icon size={20} />
                    {isExpanded && <span className="font-medium">{item.name}</span>}
                  </motion.div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout Button */}
        <div className="absolute bottom-12 left-0 right-0 px-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <LogOut size={20} />
            {isExpanded && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* ✅ Wrap the TokenHandler in Suspense to prevent Next.js build errors */}
      <Suspense fallback={null}>
        <TokenHandler />
      </Suspense>

      {/* DESKTOP SIDEBAR */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? '280px' : '80px' }}
        className="hidden lg:block fixed left-0 top-0 h-full bg-white/5 backdrop-blur-xl border-r border-white/10 z-50"
      >
        <SidebarContent isMobile={false} />
      </motion.aside>

      {/* MOBILE SIDEBAR DRAWER */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="lg:hidden fixed left-0 top-0 h-full w-[280px] bg-slate-900/95 backdrop-blur-xl border-r border-white/10 z-[70] overflow-y-auto"
            >
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute top-4 right-4 text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition z-10"
              >
                <X size={22} />
              </button>
              <SidebarContent isMobile={true} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <main
        className={`transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-[280px]' : 'lg:ml-[80px]'
        } ml-0`}
      >
        <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
          <div className="px-4 sm:px-6 lg:px-8 py-3 lg:py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="lg:hidden flex-shrink-0 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
                >
                  <Menu size={22} />
                </button>

                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white flex items-center gap-2 truncate">
                    <span>👋</span>
                    <span className="truncate">Welcome, Admin!</span>
                  </h2>
                  <p className="text-white/50 text-xs sm:text-sm mt-0.5 hidden sm:block">
                    Here's what's happening with SGS School today
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 relative rounded-xl overflow-hidden border border-yellow-400/20">
                  <Image src="/sgslogo.jpeg" alt="SGS School Logo" fill className="object-cover" />
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-white text-sm font-bold">SWAIS</p>
                  <p className="text-white/60 text-xs">SARASWATI</p>
                </div>
              </div> 
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Logout?"
        message="Are you sure you want to logout from this page?"
        confirmText="Yes, Logout"
        cancelText="Cancel"
        variant="warning"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}