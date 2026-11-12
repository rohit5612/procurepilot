import React from 'react';

const ComingSoon = ({ title = "Coming Soon", description = "This feature is under development and will be available soon." }) => {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-fg mb-4">{title}</h2>
        <p className="text-muted">{description}</p>
      </div>
    </div>
  );
};

export default ComingSoon;
