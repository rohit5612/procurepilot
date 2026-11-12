import React from 'react';

const PageNavigation = ({ pages, activePage, onPageChange }) => {
  return (
    <div className="bg-gradient-to-br from-muted/20 to-card/40 border-b border-border/60 px-6 py-4">
      <div className="flex space-x-8">
        {pages.map(page => (
          <button
            key={page.id}
            onClick={() => onPageChange(page.id)}
            className={`
              group relative px-6 py-3 text-base font-semibold transition-all duration-300 ease-out
              rounded-lg hover:shadow-md hover:scale-105
              ${activePage === page.id 
                ? 'text-primary bg-primary/10 border-2 border-primary/30 shadow-lg shadow-primary/20' 
                : 'text-muted hover:text-foreground hover:bg-card/60 hover:border-2 hover:border-border/50'
              }
            `}
          >
            {/* Active indicator */}
            {activePage === page.id && (
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary rounded-full shadow-sm" />
            )}
            
            {/* Text with enhanced styling */}
            <span className={`
              relative z-10
              ${activePage === page.id ? 'text-primary' : 'group-hover:text-foreground'}
            `}>
              {page.label}
            </span>
            
            {/* Subtle glow effect for active state */}
            {activePage === page.id && (
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 pointer-events-none" />
            )}
            
            {/* Hover underline effect */}
            <div className={`
              absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ease-out
              ${activePage === page.id ? 'w-full' : 'w-0 group-hover:w-full'}
            `} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default PageNavigation;
