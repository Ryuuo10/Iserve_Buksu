import { useMemo } from "react";

function PasswordStrengthIndicator({ password }) {
  const strength = useMemo(() => {
    if (!password) {
      return {
        score: 0,
        label: "",
        color: "",
        requirements: []
      };
    }

    let score = 0;
    const requirements = [];
    const specialCharacters = '!@#$%^&*()_+-=[]{};\':"\\|,.<>/?';

    // Length check (8+ characters)
    if (password.length >= 8) {
      score += 1;
      requirements.push({ met: true, text: "At least 8 characters" });
    } else {
      requirements.push({ met: false, text: "At least 8 characters" });
    }

    // Uppercase letter
    if (/[A-Z]/.test(password)) {
      score += 1;
      requirements.push({ met: true, text: "Uppercase letter" });
    } else {
      requirements.push({ met: false, text: "Uppercase letter" });
    }

    // Lowercase letter
    if (/[a-z]/.test(password)) {
      score += 1;
      requirements.push({ met: true, text: "Lowercase letter" });
    } else {
      requirements.push({ met: false, text: "Lowercase letter" });
    }

    // Number
    if (/\d/.test(password)) {
      score += 1;
      requirements.push({ met: true, text: "Number" });
    } else {
      requirements.push({ met: false, text: "Number" });
    }

    // Special character
    if (Array.from(password).some((char) => specialCharacters.includes(char))) {
      score += 1;
      requirements.push({ met: true, text: "Special character" });
    } else {
      requirements.push({ met: false, text: "Special character" });
    }

    // Determine strength label and color
    let label = "";
    let color = "";
    
    if (score === 0) {
      label = "";
      color = "";
    } else if (score <= 2) {
      label = "Weak";
      color = "bg-red-500";
    } else if (score <= 3) {
      label = "Medium";
      color = "bg-yellow-500";
    } else if (score <= 4) {
      label = "Strong";
      color = "bg-green-500";
    } else {
      label = "Very Strong";
      color = "bg-green-600";
    }

    return {
      score,
      label,
      color,
      requirements
    };
  }, [password]);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              level <= strength.score 
                ? strength.color 
                : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      
      {/* Strength label */}
      {strength.label && (
        <div className="text-sm font-medium">
          Password strength: 
          <span className={`ml-2 ${strength.color.replace('bg-', 'text-')}`}>
            {strength.label}
          </span>
        </div>
      )}
      
      {/* Requirements list */}
      <div className="text-xs space-y-1">
        {strength.requirements.map((req, index) => (
          <div key={index} className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 flex items-center justify-center ${
              req.met ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {req.met && (
                <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={req.met ? 'text-green-600' : 'text-gray-500'}>
              {req.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PasswordStrengthIndicator;
