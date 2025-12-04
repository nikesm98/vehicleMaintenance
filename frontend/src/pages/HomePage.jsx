import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignInButton, SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Truck, Shield, ClipboardList, BarChart3, ArrowRight, CheckCircle2 } from 'lucide-react';

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  const features = [
    {
      icon: <ClipboardList className="w-8 h-8" />,
      title: 'Digital Inspection Forms',
      description: 'Comprehensive digital forms for battery, tyre, and vehicle inspections'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Photo Documentation',
      description: 'Capture and store inspection photos with automatic cloud backup'
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: 'Real-time Dashboard',
      description: 'Track maintenance history and fleet status at a glance'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#007BC1] flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#204788]" style={{ fontFamily: 'Space Grotesk' }}>CJ Darcl</h1>
              <p className="text-xs text-slate-500">Fleet Maintenance</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <Button 
                  data-testid="signin-button"
                  className="bg-[#007BC1] hover:bg-[#006299] text-white px-6"
                >
                  Sign In with Google
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600">Welcome, {user?.firstName || 'User'}</span>
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#007BC1]/10 rounded-full mb-6">
            <CheckCircle2 className="w-4 h-4 text-[#007BC1]" />
            <span className="text-sm font-medium text-[#007BC1]">Trusted Fleet Management Solution</span>
          </div>
          
          <h1 
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#204788] mb-6"
            style={{ fontFamily: 'Space Grotesk', lineHeight: 1.1 }}
          >
            Fleet Maintenance
            <span className="block text-[#007BC1]">Made Simple</span>
          </h1>
          
          <p className="text-base lg:text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
            Streamline your vehicle inspections with digital forms, photo documentation, 
            and real-time reporting. Keep your fleet running smoothly.
          </p>
          
          <SignedIn>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                data-testid="new-inspection-btn"
                onClick={() => navigate('/maintenance')}
                className="bg-[#007BC1] hover:bg-[#006299] text-white px-8 py-6 text-lg rounded-xl"
              >
                <ClipboardList className="w-5 h-5 mr-2" />
                New Inspection
              </Button>
              <Button 
                data-testid="view-dashboard-btn"
                onClick={() => navigate('/dashboard')}
                variant="outline"
                className="border-[#204788] text-[#204788] hover:bg-[#204788]/5 px-8 py-6 text-lg rounded-xl"
              >
                <BarChart3 className="w-5 h-5 mr-2" />
                View Dashboard
              </Button>
            </div>
          </SignedIn>
          
          <SignedOut>
            <SignInButton mode="modal">
              <Button 
                data-testid="get-started-btn"
                className="bg-[#007BC1] hover:bg-[#006299] text-white px-10 py-6 text-lg rounded-xl"
              >
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </SignInButton>
          </SignedOut>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="bg-white border-slate-200 hover:border-[#007BC1]/30 transition-all duration-300 hover:shadow-lg"
              data-testid={`feature-card-${index}`}
            >
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-[#007BC1]/10 flex items-center justify-center mb-6 text-[#007BC1]">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-[#204788] mb-3" style={{ fontFamily: 'Space Grotesk' }}>
                  {feature.title}
                </h3>
                <p className="text-slate-600">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-6 py-16">
        <Card className="bg-[#204788] border-0 overflow-hidden">
          <CardContent className="p-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: '65+', label: 'Vehicles Tracked' },
                { value: '1000+', label: 'Inspections Done' },
                { value: '99.9%', label: 'Uptime' },
                { value: '24/7', label: 'Cloud Backup' }
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <p className="text-3xl sm:text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                    {stat.value}
                  </p>
                  <p className="text-blue-200 text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#007BC1] flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-[#204788]">CJ Darcl Logistics</span>
            </div>
            <p className="text-sm text-slate-500">
              © 2025 CJ Darcl. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
