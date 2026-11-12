import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, XCircle, Send, ArrowLeft } from 'lucide-react';

const AppealSubmissionPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [hasPendingAppeal, setHasPendingAppeal] = useState(false);
  
  const [formData, setFormData] = useState({
    reason: '',
    details: ''
  });

  useEffect(() => {
    checkUserStatus();
  }, [userId]);

  const checkUserStatus = async () => {
    try {
      setLoading(true);
      
                   // Check if user exists and is suspended
             const userResponse = await fetch(`http://localhost:5000/api/users/${userId}/status/public`);
      const userData = await userResponse.json();
      
                   if (!userResponse.ok) {
               throw new Error('User not found');
             }
       
             if (userData.user.status !== 'suspended') {
               setError('This appeal form is only for suspended accounts');
               return;
             }
       
             setUser(userData.user);

      // Check if user already has a pending appeal
      const appealResponse = await fetch(`http://localhost:5000/api/user-appeals/check/${userId}`);
      const appealData = await appealResponse.json();
      
      if (appealData.hasPendingAppeal) {
        setHasPendingAppeal(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.reason.trim() || !formData.details.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.reason.length < 10) {
      setError('Appeal reason must be at least 10 characters long');
      return;
    }

    if (formData.details.length < 20) {
      setError('Appeal details must be at least 20 characters long');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`http://localhost:5000/api/user-appeals/submit/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit appeal');
      }

      setSuccess(true);
      setFormData({ reason: '', details: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: 'var(--color-ring)' }}></div>
          <p className="mt-4 text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-card rounded-lg shadow-lg p-6 border border-default">
            <div className="flex items-center justify-center mb-4">
              <XCircle className="w-12 h-12" style={{ color: 'var(--color-destructive)' }} />
            </div>
            <h2 className="text-xl font-bold text-fg text-center mb-2">Error</h2>
            <p className="text-muted text-center mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="w-full btn btn-secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hasPendingAppeal) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-card rounded-lg shadow-lg p-6 border border-default">
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="w-12 h-12" style={{ color: 'var(--color-ring)' }} />
            </div>
            <h2 className="text-xl font-bold text-fg text-center mb-2">Appeal Already Submitted</h2>
            <p className="text-muted text-center mb-4">
              You already have a pending appeal. Please wait for the administrator to review your case.
            </p>
            <p className="text-sm text-muted text-center mb-6">
              You will receive an email notification once your appeal has been reviewed.
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full btn btn-secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-card rounded-lg shadow-lg p-6 border border-default">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="w-12 h-12" style={{ color: 'var(--color-chart-1)' }} />
            </div>
            <h2 className="text-xl font-bold text-fg text-center mb-2">Appeal Submitted Successfully</h2>
            <p className="text-muted text-center mb-4">
              Your appeal has been submitted and is under review. You will receive an email notification once the administrator makes a decision.
            </p>
            <p className="text-sm text-muted text-center mb-6">
              Thank you for your patience.
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full btn btn-primary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-fg mb-2">Account Appeal</h1>
          <p className="text-muted">
            Submit an appeal to request reactivation of your suspended account
          </p>
        </div>

        {/* User Info */}
        {user && (
          <div className="bg-card rounded-lg shadow-lg p-6 mb-6 border border-default">
            <h2 className="text-lg font-semibold text-fg mb-4">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-fg">Name</label>
                <p className="text-fg">{user.first_name} {user.last_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg">Email</label>
                <p className="text-fg">{user.email}</p>
              </div>
              {user.suspension_reason && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-fg">Suspension Reason</label>
                  <p className="text-fg">{user.suspension_reason}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Appeal Form */}
        <div className="bg-card rounded-lg shadow-lg p-6 border border-default">
          <h2 className="text-lg font-semibold text-fg mb-6">Submit Your Appeal</h2>
          
          {error && (
            <div className="mb-6 p-4 bg-muted border border-default rounded-lg">
              <div className="flex items-center">
                <XCircle className="w-5 h-5 mr-2" style={{ color: 'var(--color-destructive)' }} />
                <p className="text-danger">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="reason" className="block text-sm font-medium text-fg mb-2">
                Appeal Reason *
              </label>
              <input
                type="text"
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                placeholder="Brief reason for your appeal (minimum 10 characters)"
                className="input w-full"
                required
                minLength={10}
              />
              <p className="text-sm text-muted mt-1">
                {formData.reason.length}/10 characters minimum
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="details" className="block text-sm font-medium text-fg mb-2">
                Detailed Explanation *
              </label>
              <textarea
                id="details"
                name="details"
                value={formData.details}
                onChange={handleInputChange}
                placeholder="Please provide a detailed explanation of your situation and why you believe your account should be reactivated (minimum 20 characters)"
                rows={6}
                className="input w-full"
                required
                minLength={20}
              />
              <p className="text-sm text-muted mt-1">
                {formData.details.length}/20 characters minimum
              </p>
            </div>

            <div className="bg-muted border border-default rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 mt-0.5" style={{ color: 'var(--color-ring)' }} />
                <div>
                  <h3 className="text-sm font-medium text-fg mb-1">Important Information</h3>
                  <ul className="text-sm text-fg space-y-1">
                    <li>• Appeals are reviewed by administrators within 1-3 business days</li>
                    <li>• You will receive an email notification of the decision</li>
                    <li>• Please provide accurate and truthful information</li>
                    <li>• Only one appeal can be submitted per suspension</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="btn btn-secondary flex-1"
                disabled={submitting}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Appeal
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AppealSubmissionPage;
