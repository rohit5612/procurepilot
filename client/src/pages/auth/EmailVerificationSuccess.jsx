import { CheckCircle, Clock, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const EmailVerificationSuccess = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Success Icon */}
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Email Verified Successfully!
          </h1>

          {/* Message */}
          <div className="space-y-4 mb-8">
            <p className="text-gray-600">
              Your email address has been verified. Thank you for completing this step!
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Next Step: Admin Approval
                  </p>
                  <p className="text-sm text-blue-700">
                    An administrator will review your account and approve your access shortly. 
                    You will receive an email notification once your account is approved.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    What happens next?
                  </p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Admin reviews your registration details</li>
                    <li>• Account approval decision is made</li>
                    <li>• You receive approval/rejection email</li>
                    <li>• Login access is granted (if approved)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              to="/login"
              className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Go to Login Page
            </Link>
            
            <p className="text-xs text-gray-500">
              You can check your login page for status updates, but you won't be able to log in until approved.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Need help? Contact support at{' '}
            <a href="mailto:support@erp.com" className="text-blue-600 hover:text-blue-500">
              support@erp.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationSuccess;
