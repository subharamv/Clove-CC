import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw new Error(error.message || 'Login failed. Check your email and password.');
      }

      onLogin();
    } catch (err: any) {
      setMessage(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setMessage('Password reset link sent to your email. Check your inbox.');
      setTimeout(() => setMode('login'), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 p-2 mb-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="Clove_Logo" width="8em" viewBox="0 0 112.918 40">
                <g id="Clove_Logo_cloe" data-name="Clove Logo" transform="translate(-0.749 -1)">
                  <path d="M73.807,11.411a13.36,13.36,0,0,0-1.871-4.367,13.516,13.516,0,0,0-3.822-3.822,13.421,13.421,0,0,0-14.774,0,13.527,13.527,0,0,0-3.822,3.822,13.452,13.452,0,0,0-2.214,7.387,13.42,13.42,0,0,0,6.036,11.206,13.359,13.359,0,0,0,7.367,2.215l.021,0,.021,0a13.352,13.352,0,0,0,7.366-2.215,13.5,13.5,0,0,0,3.822-3.822,13.417,13.417,0,0,0,1.871-10.4m-13.079,10.4H60.7a7.386,7.386,0,1,1,7.413-7.392v.013a7.385,7.385,0,0,1-7.36,7.378Z" transform="translate(-7.759 -0.001)" fill="#fff"></path>
                  <path d="M33.753,21.816V1.008H27.714V27.853H41.089L42.7,21.816Z" transform="translate(-4.494 -0.001)" fill="#fff"></path>
                  <path d="M14.146,21.815a7.385,7.385,0,0,1,.027-14.771h4.217L20,1.007H14.174A13.36,13.36,0,0,0,6.787,3.223,13.505,13.505,0,0,0,2.966,7.045a13.307,13.307,0,0,0-1.871,4.367,13.348,13.348,0,0,0,0,6.037,13.322,13.322,0,0,0,1.871,4.367,13.505,13.505,0,0,0,3.822,3.822,13.355,13.355,0,0,0,7.367,2.215l.02,0,.02,0h4.2L20,21.815Z" transform="translate(0 -0.001)" fill="#fff"></path>
                  <path d="M120.636,21.815V17.448h8.41V11.411h-8.41V7.044h10.4l1.607-6.037H114.6V27.852h16.438l1.607-6.037Z" transform="translate(-18.975 -0.001)" fill="#fff"></path>
                  <path d="M83.949,1.007H77.91L91.589,27.853l3.021-5.921Z" transform="translate(-12.86 -0.001)" fill="#fff"></path>
                  <path d="M.75,43.823H2.3v4.09h.877v-4.09H4.726v-.815H.75Z" transform="translate(0 -7.001)" fill="#fff"></path>
                  <path d="M13.568,45.793H16.05v-.814H13.568V43.823h2.65v-.814H12.692v4.9h3.557V47.1H13.568Z" transform="translate(-1.991 -7.002)" fill="#fff"></path>
                  <path d="M39.889,44.941H37.7V43.009h-.877v4.9H37.7V45.757h2.191v2.156h.877v-4.9h-.877Z" transform="translate(-6.012 -7.001)" fill="#fff"></path>
                  <path d="M52.372,46.289l-2.261-3.281h-.818v4.9h.877v-3.28l2.26,3.28h.821v-4.9h-.878Z" transform="translate(-8.091 -7.001)" fill="#fff"></path>
                  <path d="M65.571,43.68a2.146,2.146,0,0,0-.734-.572,2.551,2.551,0,0,0-2.032,0,2.162,2.162,0,0,0-.736.572,2.443,2.443,0,0,0-.433.813,3.257,3.257,0,0,0,0,1.9,2.413,2.413,0,0,0,.434.812,2.165,2.165,0,0,0,.735.567,2.531,2.531,0,0,0,2.034,0,2.159,2.159,0,0,0,.73-.567A2.41,2.41,0,0,0,66,46.389a3.255,3.255,0,0,0,0-1.894,2.469,2.469,0,0,0-.433-.814m-2.4,3.35a1.262,1.262,0,0,1-.442-.377,1.764,1.764,0,0,1-.265-.557,2.514,2.514,0,0,1-.088-.654,2.473,2.473,0,0,1,.088-.655,1.743,1.743,0,0,1,.264-.555,1.282,1.282,0,0,1,.443-.379,1.593,1.593,0,0,1,1.306,0,1.317,1.317,0,0,1,.441.379,1.753,1.753,0,0,1,.265.553,2.472,2.472,0,0,1,0,1.31,1.725,1.725,0,0,1-.265.557,1.275,1.275,0,0,1-.441.378,1.573,1.573,0,0,1-1.306,0" transform="translate(-10.124 -6.983)" fill="#fff"></path>
                  <path d="M75.412,43.009h-.877v4.9h3.372V47.1H75.412Z" transform="translate(-12.298 -7.001)" fill="#fff"></path>
                  <path d="M89.557,43.68a2.152,2.152,0,0,0-.732-.572,2.555,2.555,0,0,0-2.033,0,2.138,2.138,0,0,0-.735.572,2.451,2.451,0,0,0-.433.814,3.271,3.271,0,0,0,0,1.893,2.374,2.374,0,0,0,.435.812,2.147,2.147,0,0,0,.733.569,2.336,2.336,0,0,0,1.019.213,2.3,2.3,0,0,0,1.015-.213,2.135,2.135,0,0,0,.73-.568,2.37,2.37,0,0,0,.435-.811,3.239,3.239,0,0,0,0-1.9,2.423,2.423,0,0,0-.433-.815m-1.747.031a1.393,1.393,0,0,1,.65.141,1.286,1.286,0,0,1,.442.381,1.649,1.649,0,0,1,.263.553,2.429,2.429,0,0,1,0,1.31,1.679,1.679,0,0,1-.263.556,1.275,1.275,0,0,1-.442.378,1.565,1.565,0,0,1-1.3,0,1.242,1.242,0,0,1-.443-.379,1.654,1.654,0,0,1-.265-.555,2.431,2.431,0,0,1,0-1.311,1.672,1.672,0,0,1,.265-.552,1.263,1.263,0,0,1,.443-.379,1.4,1.4,0,0,1,.655-.142" transform="translate(-14.122 -6.983)" fill="#fff"></path>
                  <path d="M111.316,47.913h.877v-4.9h-.877v4.9Z" transform="translate(-18.428 -7.001)" fill="#fff"></path>
                  <path d="M121.031,45.793h2.482v-.814h-2.482V43.823h2.651v-.814h-3.528v4.9h3.559V47.1h-2.682Z" transform="translate(-19.901 -7.002)" fill="#fff"></path>
                  <path d="M27.625,45.871l-.008.078a1.714,1.714,0,0,1-.125.491,1.357,1.357,0,0,1-.251.386,1.084,1.084,0,0,1-.359.254,1.394,1.394,0,0,1-1.122-.05,1.252,1.252,0,0,1-.443-.379,1.668,1.668,0,0,1-.264-.555,2.49,2.49,0,0,1-.089-.653,2.454,2.454,0,0,1,.09-.657,1.693,1.693,0,0,1,.263-.553,1.263,1.263,0,0,1,.443-.379,1.427,1.427,0,0,1,1.051-.082,1.255,1.255,0,0,1,.339.173,1.075,1.075,0,0,1,.255.282h0a1.224,1.224,0,0,1,.154.384l.007.029h.876l-.013-.105a1.773,1.773,0,0,0-.241-.71,1.881,1.881,0,0,0-.469-.513A2.011,2.011,0,0,0,27.1,43a2.428,2.428,0,0,0-1.7.108,2.161,2.161,0,0,0-.735.572,2.422,2.422,0,0,0-.432.815,3.243,3.243,0,0,0,0,1.893,2.358,2.358,0,0,0,.434.812,2.155,2.155,0,0,0,.733.569,2.331,2.331,0,0,0,1.019.213,2.176,2.176,0,0,0,.8-.141,1.91,1.91,0,0,0,.636-.4,2.073,2.073,0,0,0,.432-.63A2.574,2.574,0,0,0,28.49,46l.013-.125Z" transform="translate(-3.89 -6.982)" fill="#fff"></path>
                  <path d="M100.395,45.994H101.9a1.547,1.547,0,0,1-.074.356,1.194,1.194,0,0,1-.249.435,1.157,1.157,0,0,1-.412.284,1.588,1.588,0,0,1-1.224-.038,1.254,1.254,0,0,1-.444-.379,1.666,1.666,0,0,1-.263-.555,2.453,2.453,0,0,1,0-1.311,1.68,1.68,0,0,1,.263-.553,1.289,1.289,0,0,1,.443-.378,1.517,1.517,0,0,1,1.144-.057,1.322,1.322,0,0,1,.374.225,1.186,1.186,0,0,1,.245.3.845.845,0,0,1,.06.18h.891a2.014,2.014,0,0,0-.239-.662A1.885,1.885,0,0,0,101.321,43a2.562,2.562,0,0,0-1.744.108,2.165,2.165,0,0,0-.734.572,2.406,2.406,0,0,0-.432.815,3.216,3.216,0,0,0,0,1.893,2.36,2.36,0,0,0,.432.812,2.161,2.161,0,0,0,.735.569,2.339,2.339,0,0,0,1.018.213,2.415,2.415,0,0,0,.52-.056,1.825,1.825,0,0,0,.487-.182,1.781,1.781,0,0,0,.362-.265l.03.414h.742V45.178h-2.342Z" transform="translate(-16.253 -6.983)" fill="#fff"></path>
                  <path d="M135.353,45.926a1.151,1.151,0,0,0-.308-.4,1.677,1.677,0,0,0-.423-.259,3.311,3.311,0,0,0-.483-.165l-1.088-.268a1.7,1.7,0,0,1-.223-.072.515.515,0,0,1-.154-.092.337.337,0,0,1-.089-.119.428.428,0,0,1-.033-.177.62.62,0,0,1,.066-.307.543.543,0,0,1,.174-.193.8.8,0,0,1,.28-.118,1.506,1.506,0,0,1,.754.013,1,1,0,0,1,.31.158.763.763,0,0,1,.207.246.824.824,0,0,1,.088.352l0,.038h.874v-.051a1.483,1.483,0,0,0-.579-1.215,1.81,1.81,0,0,0-.6-.3,2.474,2.474,0,0,0-1.551.059,1.568,1.568,0,0,0-.547.382,1.249,1.249,0,0,0-.283.5,1.582,1.582,0,0,0-.072.443,1.3,1.3,0,0,0,.105.538,1.189,1.189,0,0,0,.274.377,1.233,1.233,0,0,0,.389.242,3.319,3.319,0,0,0,.409.137l.989.242a2.808,2.808,0,0,1,.294.09,1.033,1.033,0,0,1,.245.127.568.568,0,0,1,.155.161.4.4,0,0,1,.051.208.484.484,0,0,1-.079.286.719.719,0,0,1-.229.216,1.115,1.115,0,0,1-.319.132,1.776,1.776,0,0,1-.849-.011,1.041,1.041,0,0,1-.382-.161.687.687,0,0,1-.235-.281v0a1,1,0,0,1-.085-.468l0-.058h-.877l0,.043a1.818,1.818,0,0,0,.128.806,1.443,1.443,0,0,0,.433.569,1.819,1.819,0,0,0,.655.318,3.066,3.066,0,0,0,.788.1,3.017,3.017,0,0,0,.731-.078,1.983,1.983,0,0,0,.533-.214,1.273,1.273,0,0,0,.36-.315,1.5,1.5,0,0,0,.2-.333,1.258,1.258,0,0,0,.093-.326,2.044,2.044,0,0,0,.015-.227A1.312,1.312,0,0,0,135.353,45.926Z" transform="translate(-21.797 -6.983)" fill="#fff"></path>
                </g>
                <g id="Clove_Logo_v" data-name="Clove Logo">
                  <path d="M99.348,17.7q-.253.614-.556,1.252c-.046.1-.092.193-.14.289L107.948,1H94.031a10.347,10.347,0,0,1,4.651,3.481h0a10.3,10.3,0,0,1,.763,1.172,10.546,10.546,0,0,1,.68,1.479c.088.241.168.489.242.744a11.8,11.8,0,0,1,.426,3.693A17.82,17.82,0,0,1,99.348,17.7Z" transform="translate(-15.547)" fill="#f9a64a"></path>
                  <path d="M102.367,12.813a17.158,17.158,0,0,0,.365-4.351,11.761,11.761,0,0,1-1.414.658,11.8,11.8,0,0,1,.426,3.692,17.82,17.82,0,0,1-1.444,6.133q-.252.614-.556,1.252c.207-.424.4-.84.582-1.252A29.717,29.717,0,0,0,102.367,12.813Z" transform="translate(-16.499 -1.244)" fill="#ffcd7b"></path>
                  <path d="M100.767,3.058A8.908,8.908,0,0,0,99.4,1H94.031a10.347,10.347,0,0,1,4.651,3.481,13.754,13.754,0,0,0,1.411-.1c.388-.048.765-.112,1.132-.188A9.655,9.655,0,0,0,100.767,3.058Z" transform="translate(-15.547)" fill="#f9a64a"></path>
                  <path d="M102.705,7.771a11.47,11.47,0,0,0-.551-2.94c-.367.076-.743.139-1.132.188a13.991,13.991,0,0,1-1.411.1,10.3,10.3,0,0,1,.762,1.172,10.546,10.546,0,0,1,.68,1.479c.088.241.168.489.242.744a12.947,12.947,0,0,0,1.414-.658Z" transform="translate(-16.477 -0.639)" fill="#fcba63"></path>
                  <path d="M104.515,1H100.47a8.908,8.908,0,0,1,1.37,2.058,9.657,9.657,0,0,1,.457,1.135,15.256,15.256,0,0,0,2.574-.777A7.312,7.312,0,0,0,104.515,1Z" transform="translate(-16.62)" fill="#f69333"></path>
                  <path d="M102.663,4.676a11.468,11.468,0,0,1,.551,2.94l0,.086.155-.086a13.853,13.853,0,0,0,1.6-1.048c.008-.047.261-1.847.262-2.668A15.257,15.257,0,0,1,102.663,4.676Z" transform="translate(-16.986 -0.483)" fill="#f9a64a"></path>
                  <path d="M102.859,8.149l-.155.086a17.158,17.158,0,0,1-.365,4.351,29.718,29.718,0,0,1-2.041,6.133c-.183.412-.376.828-.583,1.252-.046.1-.092.192-.14.289.2-.389.457-.913.757-1.541.747-1.563,1.739-3.768,2.592-6.133a37.386,37.386,0,0,0,1.327-4.437c.08-.353.148-.7.209-1.048A13.853,13.853,0,0,1,102.859,8.149Z" transform="translate(-16.471 -1.017)" fill="#fcba63"></path>
                  <path d="M105.324,1a7.313,7.313,0,0,1,.357,2.416A15.549,15.549,0,0,0,109.831,1Z" transform="translate(-17.429)" fill="#f48120"></path>
                  <path d="M105.7,3.416c0,.822-.254,2.622-.263,2.668.153-.122.3-.252.453-.385a24.711,24.711,0,0,0,3.893-4.6l.067-.1A15.55,15.55,0,0,1,105.7,3.416Z" transform="translate(-17.448)" fill="#f69333"></path>
                  <path d="M108.792,1.1A24.711,24.711,0,0,1,104.9,5.7c-.149.133-.3.263-.453.385-.061.346-.129.7-.209,1.048a37.383,37.383,0,0,1-1.327,4.437c-.853,2.364-1.845,4.569-2.592,6.133-.3.628-.56,1.152-.757,1.541l-.068.138.856-1.679,3.125-6.133,2.26-4.437L108.859,1Z" transform="translate(-16.458)" fill="#f9a64a"></path>
                </g>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Clovians</h1>
            <p className="text-slate-600">Cafeteria Management System</p>
          </div>

          {/* Form */}
          <form onSubmit={mode === 'login' ? handleLogin : handleForgotPassword} className="space-y-5">
            {message && (
              <div className={`p-4 rounded-lg text-sm font-medium ${message.includes('sent')
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                {message}
              </div>
            )}

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <svg className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                  required
                />
              </div>
            </div>

            {/* Password Input - only show in login mode */}
            {mode === 'login' && (
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <svg className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                    required
                  />
                </div>
              </div>
            )}

            {/* Remember Me & Forgot Password */}
            {mode === 'login' && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-orange-600 border-slate-300 rounded" />
                  <span className="text-slate-600">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-orange-600 font-semibold hover:text-orange-700"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {mode === 'login' ? 'Logging in...' : 'Sending...'}
                </>
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Send Reset Link'}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>

            {/* Mode Toggle */}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setMessage('');
                }}
                className="w-full text-slate-600 hover:text-slate-900 font-semibold py-2"
              >
                Back to Login
              </button>
            )}
          </form>

          {/* Footer */}
          <p className="text-center text-slate-500 text-sm mt-6">
            {mode === 'login' ? 'Secure Supabase Authentication' : 'Reset your password'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
