import React, { useState, useEffect } from 'react';
import { View, Employee } from '../types';
import { supabase } from '../supabaseClient';
import { formatRupees } from '../utils/currencyUtils';

interface LandingProps {
  onNavigate: (view: View) => void;
}

const Landing: React.FC<LandingProps> = ({ onNavigate }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [recentCoupons, setRecentCoupons] = useState<Employee[]>([]);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    loadRecentCoupons();
  }, []);

  const loadRecentCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const transformed = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        empId: row.emp_id,
        otHours: row.ot_hours || 0,
        amount: row.amount || 0,
        issueDate: row.issue_date,
        validTill: row.valid_till,
        serialCode: row.serial_code,
        status: row.status,
        created_at: row.created_at,
        couponImageUrl: row.coupon_image_url
      }));

      setRecentCoupons(transformed);
    } catch (err) {
      console.warn('Failed to load recent coupons:', err);
    }
  };

  const handleGetStarted = () => {
    onNavigate(View.LOGIN);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob ${isLoaded ? 'animate-pulse' : ''}`}></div>
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000 ${isLoaded ? 'animate-pulse' : ''}`}></div>
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-rose-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000 ${isLoaded ? 'animate-pulse' : ''}`}></div>
      </div>

      {/* Hero Section */}
      <header className="relative z-10 px-6 pt-12 pb-8">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Clovians Cafeteria
            </h1>
          </div>
          <button
            onClick={handleGetStarted}
            className="px-6 py-2 bg-white/80 backdrop-blur-sm text-orange-600 rounded-full font-semibold hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
          >
            Admin Portal
          </button>
        </nav>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
        <div className="text-center py-16">
          <div className={`transform transition-all duration-1000 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <h2 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="block bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 bg-clip-text text-transparent">
                Smart Coupon
              </span>
              <span className="block text-4xl md:text-6xl text-gray-800 mt-2">
                Management System
              </span>
            </h2>

            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Revolutionize your cafeteria experience with intelligent coupon management.
              Issue, track, and redeem digital coupons seamlessly.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleGetStarted}
                className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-full font-semibold text-lg hover:from-orange-600 hover:to-amber-700 transform hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl"
              >
                Get Started Now
              </button>
              <div className="px-8 py-4 bg-white/80 backdrop-blur-sm rounded-full text-gray-700 font-semibold text-lg shadow-lg">
                ⭐ 500+ Coupons Issued Daily
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          {[
            {
              icon: "🎫",
              title: "Smart Issuance",
              description: "Automated coupon generation with customizable prefixes, serial numbers, and validity periods.",
              gradient: "from-blue-400 to-blue-600"
            },
            {
              icon: "📊",
              title: "Real-time Tracking",
              description: "Monitor coupon status, track redemptions, and generate comprehensive reports instantly.",
              gradient: "from-green-400 to-green-600"
            },
            {
              icon: "👥",
              title: "Employee Management",
              description: "Seamlessly manage employee profiles, OT hours, and coupon allocations in one place.",
              gradient: "from-purple-400 to-purple-600"
            }
          ].map((feature, index) => (
            <div
              key={index}
              className={`transform transition-all duration-700 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-white/50">
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-lg`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Coupons Section */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-800 mb-4">Recent Coupons</h3>
            <p className="text-gray-600 text-lg">Latest issued coupons in the system</p>
          </div>

          {recentCoupons.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 shadow-xl border border-white/50 text-center">
              <p className="text-gray-600 text-lg mb-6">No coupons issued yet. Start issuing coupons through the admin portal.</p>
              <button
                onClick={() => onNavigate(View.LOGIN)}
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold transition-all duration-300"
              >
                Go to Admin Portal
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {recentCoupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-white/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-800 truncate">{coupon.name}</h4>
                        <p className="text-xs text-gray-500 font-mono mt-1">{coupon.empId}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap ml-2 ${coupon.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-700' :
                        coupon.status === 'READY' ? 'bg-amber-100 text-amber-700' :
                          coupon.status === 'ISSUED' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                        }`}>
                        {coupon.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 uppercase font-bold">Amount</span>
                        <span className="text-sm font-bold text-emerald-600">{formatRupees(coupon.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 uppercase font-bold">Serial</span>
                        <span className="text-xs font-mono text-gray-700">{coupon.serialCode}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 uppercase font-bold">Issue Date</span>
                        <span className="text-xs text-gray-600">{coupon.issueDate}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-[10px] text-gray-400">
                        Issued: {coupon.created_at ? new Date(coupon.created_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 text-center">
                <button
                  onClick={() => onNavigate(View.ISSUED_HISTORY)}
                  className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-full font-semibold transition-all duration-300 hover:scale-105"
                >
                  View All Coupons →
                </button>
              </div>
            </>
          )}
        </div>
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-gray-800 mb-4">Trusted by Leading Organizations</h3>
          <p className="text-gray-600 text-lg">Join hundreds of companies streamlining their cafeteria operations</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { number: "10K+", label: "Active Users" },
            { number: "50K+", label: "Coupons Monthly" },
            { number: "99.9%", label: "Uptime" },
            { number: "4.9★", label: "User Rating" }
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-2">
                {stat.number}
              </div>
              <div className="text-gray-600 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-20 border-t border-orange-200 bg-white/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                </svg>
              </div>
              <span className="text-gray-700 font-semibold">Clovians Cafeteria</span>
            </div>
            <div className="text-gray-600 text-center">
              © 2024 Clovians Cafeteria. Built with ❤️ for better dining experiences.
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default Landing;