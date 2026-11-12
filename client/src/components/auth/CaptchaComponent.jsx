import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const CaptchaComponent = ({ onCaptchaChange, error }) => {
  const [captcha, setCaptcha] = useState({ question: '', answer: '' });
  const [userAnswer, setUserAnswer] = useState('');

  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-', '×'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let answer;
    switch (operator) {
      case '+':
        answer = num1 + num2;
        break;
      case '-':
        answer = num1 - num2;
        break;
      case '×':
        answer = num1 * num2;
        break;
      default:
        answer = num1 + num2;
    }
    
    const question = `${num1} ${operator} ${num2} = ?`;
    setCaptcha({ question, answer: answer.toString() });
    setUserAnswer('');
    onCaptchaChange(''); // Clear the token when generating new captcha
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleAnswerChange = (e) => {
    const value = e.target.value;
    setUserAnswer(value);
    
    if (value === captcha.answer) {
      onCaptchaChange('captcha-verified-' + Date.now());
    } else {
      onCaptchaChange('');
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">
        Security Verification
      </label>
      <div className="flex items-center space-x-3">
        <div className="flex-1 bg-gray-100 p-3 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-center">
            <span className="text-lg font-mono font-bold text-gray-700">
              {captcha.question}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={generateCaptcha}
          className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
          title="Refresh captcha"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>
      <input
        type="text"
        value={userAnswer}
        onChange={handleAnswerChange}
        className={`input mt-2 ${error ? 'input-error' : ''}`}
        placeholder="Enter your answer"
        maxLength="3"
      />
      {error && (
        <p className="form-error">{error}</p>
      )}
      <p className="text-xs text-gray-500 mt-1">
        Please solve the math problem to verify you're human
      </p>
    </div>
  );
};

export default CaptchaComponent;
