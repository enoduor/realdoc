import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ErrorModal from './ErrorModal';

const Dashboard = () => {
  const navigate = useNavigate();
  const [errorModal, setErrorModal] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    type: 'error'
  });

  const features = [
    { 
      name: 'Documentation Generator', 
      description: 'Generate comprehensive documentation for your online applications', 
      icon: '📚', 
      link: '/documentation-generator' 
    },
    { 
      name: 'SEO Generator', 
      description: 'Generate comprehensive SEO analysis and recommendations', 
      icon: '🔍', 
      link: '/seo-generator' 
    },
    { 
      name: 'Website Analytics', 
      description: 'Analyze website traffic and competitor insights', 
      icon: '📊', 
      link: '/website-analytics' 
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

          {/* Feature cards */}
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
              {features.map((feature) => (
                <Link
                  key={feature.name}
                  to={feature.link}
                  className="block p-8 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 bg-white hover:border-blue-200 border-blue-100 cursor-pointer"
                >
                  <div className="flex items-center">
                    <span className="text-4xl mr-4">{feature.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {feature.name}
                      </h3>
                      <p className="text-sm mt-1 text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.show}
        onClose={() => setErrorModal({ show: false, title: '', message: '', type: 'error' })}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
      />
    </div>
  );
};

export default Dashboard;
