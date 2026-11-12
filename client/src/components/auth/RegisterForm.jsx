import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  CreditCard,
  Briefcase,
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import CaptchaComponent from './CaptchaComponent';
import AuthShell, { AuthFormCard, AuthInput } from './AuthShell';

const STEPS = [
  { id: 'personal', title: 'About you', subtitle: 'Identity & contact' },
  { id: 'org', title: 'Your role', subtitle: 'Organization details' },
  { id: 'account', title: 'Access', subtitle: 'Credentials & verification' },
];

const RegisterForm = () => {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    mobileNumber: '',
    aadharCard: '',
    employeeId: '',
    designation: '',
    dateOfBirth: '',
    captchaToken: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [touched, setTouched] = useState({});

  const { register, error: authError, clearError } = useAuth();
  const navigate = useNavigate();

  const passwordStrength = useMemo(() => {
    const pwd = formData.password || '';
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[@$!%*?&]/.test(pwd)) score++;
    const normalized = Math.min(4, Math.max(0, score - 1));
    const labels = ['Very Weak', 'Weak', 'Good', 'Strong', 'Very Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-600'];
    return { score: normalized, label: labels[score] || 'Very Weak', color: colors[score] || 'bg-red-500' };
  }, [formData.password]);

  useEffect(() => {
    if (touched.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: formData.password === formData.confirmPassword ? '' : 'Passwords do not match',
      }));
    }
    if (touched.password) {
      let pwdError = '';
      if (!formData.password) pwdError = 'Password is required';
      else if (formData.password.length < 8) pwdError = 'Password must be at least 8 characters';
      else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+/.test(formData.password)) {
        pwdError = 'Include uppercase, lowercase, number, and special character';
      }
      setErrors((prev) => ({ ...prev, password: pwdError }));
    }
  }, [formData.password, formData.confirmPassword, touched.password, touched.confirmPassword]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (authError) clearError();
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    if (!formData[name] && name !== 'captchaToken') {
      setErrors((prev) => ({ ...prev, [name]: 'This field is required' }));
    }
  };

  const validatePersonal = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.mobileNumber.trim()) newErrors.mobileNumber = 'Mobile number is required';
    else if (!/^[+]?[1-9][\d\s\-()]{7,20}$/.test(formData.mobileNumber)) {
      newErrors.mobileNumber = 'Please enter a valid mobile number';
    }
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    else {
      const dob = new Date(formData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      if (age < 18 || age > 100) newErrors.dateOfBirth = 'Age must be between 18 and 100 years';
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateOrg = () => {
    const newErrors = {};
    if (!formData.aadharCard.trim()) newErrors.aadharCard = 'Aadhar card number is required';
    else if (!/^[0-9]{12}$/.test(formData.aadharCard)) {
      newErrors.aadharCard = 'Aadhar card number must be exactly 12 digits';
    }
    if (!formData.employeeId.trim()) newErrors.employeeId = 'Employee ID is required';
    if (!formData.designation.trim()) newErrors.designation = 'Designation is required';
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateAccount = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email address';
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    else if (formData.username.length < 3) newErrors.username = 'Username must be at least 3 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
    }
    if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!formData.captchaToken) newErrors.captcha = 'Please complete the security verification';
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateForm = () => validatePersonal() && validateOrg() && validateAccount();

  const goNext = () => {
    const validators = [validatePersonal, validateOrg, validateAccount];
    if (validators[step]()) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      goNext();
      return;
    }
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await register(formData);
      setShowSuccessDialog(true);
    } catch (err) {
      console.error('Registration error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false);
    setTimeout(() => navigate('/login'), 400);
  };

  const registerFeatures = [
    { title: 'Verified onboarding', detail: 'Email verification and captcha keep your workspace secure.' },
    { title: 'Role-based access', detail: 'Permissions aligned with how your team buys.' },
    { title: 'Audit-ready from day one', detail: 'Every action logged for compliance and review.' },
  ];

  return (
    <AuthShell
      badge="Workspace onboarding"
      headline="Request access to"
      headlineAccent="ProcurePilot"
      description="Submit your details for review. Once approved, you’ll manage requisitions, policies, and approvals in one place."
      features={registerFeatures}
      formMaxWidth="max-w-xl"
      alternateLink={{ to: '/login', label: 'Sign in →' }}
    >
      <AuthFormCard
        title="Request access"
        subtitle="Complete the steps below — admins may review before activation"
        headerAction={
          <Link to="/login" className="text-sm font-medium text-primary hover:text-primary/80 whitespace-nowrap">
            Sign in
          </Link>
        }
      >
        {/* Stepper */}
        <nav aria-label="Registration progress" className="mb-8">
          <ol className="flex items-center gap-2 sm:gap-3">
            {STEPS.map((s, index) => {
              const done = index < step;
              const current = index === step;
              return (
                <li key={s.id} className="flex-1 min-w-0">
                  <div className="flex flex-col items-stretch gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold border transition-colors',
                          done && 'bg-primary text-primary-foreground border-primary',
                          current && !done && 'border-primary text-primary bg-secondary',
                          !done && !current && 'border-border text-muted bg-card'
                        )}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : index + 1}
                      </span>
                      {index < STEPS.length - 1 ? (
                        <div
                          className={clsx('h-0.5 flex-1 rounded-full', done ? 'bg-primary' : 'bg-border')}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className="hidden sm:block pl-0.5">
                      <p className={clsx('text-xs font-semibold truncate', current ? 'text-fg' : 'text-muted')}>
                        {s.title}
                      </p>
                      <p className="text-[10px] text-muted truncate">{s.subtitle}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="sm:hidden mt-3 text-sm font-medium text-fg">
            Step {step + 1} of {STEPS.length}: {STEPS[step].title}
          </p>
        </nav>

        {authError ? (
          <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {authError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 animate-[fadeIn_0.25s_ease-out]">
              <AuthInput
                id="firstName"
                name="firstName"
                label="First name"
                value={formData.firstName}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.firstName}
                placeholder="Jane"
                disabled={isSubmitting}
                autoComplete="given-name"
              />
              <AuthInput
                id="lastName"
                name="lastName"
                label="Last name"
                value={formData.lastName}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.lastName}
                placeholder="Doe"
                disabled={isSubmitting}
                autoComplete="family-name"
              />
              <AuthInput
                id="mobileNumber"
                name="mobileNumber"
                label="Mobile number"
                type="tel"
                icon={Phone}
                value={formData.mobileNumber}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.mobileNumber}
                placeholder="+91 98765 43210"
                disabled={isSubmitting}
                autoComplete="tel"
              />
              <AuthInput
                id="dateOfBirth"
                name="dateOfBirth"
                label="Date of birth"
                type="date"
                icon={Calendar}
                value={formData.dateOfBirth}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.dateOfBirth}
                disabled={isSubmitting}
                autoComplete="bday"
              />
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 animate-[fadeIn_0.25s_ease-out]">
              <AuthInput
                id="aadharCard"
                name="aadharCard"
                label="Aadhar card number"
                icon={CreditCard}
                value={formData.aadharCard}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.aadharCard}
                placeholder="12-digit number"
                maxLength={12}
                disabled={isSubmitting}
              />
              <AuthInput
                id="employeeId"
                name="employeeId"
                label="Employee ID"
                icon={Briefcase}
                value={formData.employeeId}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.employeeId}
                placeholder="EMP-0000"
                disabled={isSubmitting}
              />
              <AuthInput
                id="designation"
                name="designation"
                label="Designation"
                value={formData.designation}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.designation}
                placeholder="e.g. Procurement Manager"
                disabled={isSubmitting}
                className="sm:col-span-2"
              />
              <p className="sm:col-span-2 text-xs text-muted leading-relaxed rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                Organization details help your admin match you to the right policies and approval chains.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-[fadeIn_0.25s_ease-out]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <AuthInput
                  id="email"
                  name="email"
                  label="Work email"
                  type="email"
                  icon={Mail}
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={errors.email}
                  placeholder="you@company.com"
                  disabled={isSubmitting}
                  autoComplete="email"
                />
                <AuthInput
                  id="username"
                  name="username"
                  label="Username"
                  icon={User}
                  value={formData.username}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={errors.username}
                  placeholder="jane_doe"
                  disabled={isSubmitting}
                  autoComplete="username"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <AuthInput
                    id="password"
                    name="password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    icon={Lock}
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.password}
                    placeholder="Create a strong password"
                    disabled={isSubmitting}
                    autoComplete="new-password"
                    trailing={
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg p-1"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isSubmitting}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                  {formData.password ? (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted">Strength</span>
                        <span className="text-xs font-medium text-fg">{passwordStrength.label}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={clsx('h-full transition-all duration-300', passwordStrength.color)}
                          style={{ width: `${((passwordStrength.score + 1) / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
                <AuthInput
                  id="confirmPassword"
                  name="confirmPassword"
                  label="Confirm password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  icon={Lock}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={errors.confirmPassword}
                  placeholder="Repeat password"
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  trailing={
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg p-1"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isSubmitting}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-fg mb-1">Security verification</p>
                <p className="text-xs text-muted mb-3">Complete the check below to submit your request.</p>
                <CaptchaComponent
                  onCaptchaChange={(token) => setFormData((prev) => ({ ...prev, captchaToken: token }))}
                  error={errors.captcha}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                disabled={isSubmitting}
                className="btn btn-secondary flex-1 sm:flex-none py-2.5 gap-1"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </button>
            ) : (
              <div className="hidden sm:block sm:flex-1" />
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary flex-1 py-3 text-sm font-semibold gap-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : step < STEPS.length - 1 ? (
                <>
                  Continue
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </>
              ) : (
                'Submit access request'
              )}
            </button>
          </div>

          <p className="text-center text-sm text-muted pt-1">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </AuthFormCard>

      {showSuccessDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1220]/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-success-title"
        >
          <div className="page-panel max-w-md w-full p-8 shadow-2xl fade-in text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-chart-2/15 text-chart-2 mb-5">
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            </div>
            <h3 id="register-success-title" className="text-xl font-bold text-fg tracking-tight">
              Request received
            </h3>
            <p className="text-sm text-muted mt-3 leading-relaxed">
              Check your email for a verification link to complete registration. You’ll be redirected to sign in shortly.
            </p>
            <button type="button" onClick={handleSuccessDialogClose} className="btn btn-primary w-full mt-6 py-3">
              Continue to sign in
            </button>
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
};

export default RegisterForm;
