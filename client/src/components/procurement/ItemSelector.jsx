import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../../utils/api.js';

const ItemSelector = ({ onItemSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search items when search term changes
  useEffect(() => {
    const searchItems = async () => {
      if (searchTerm.length < 2) {
        setItems([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          search: searchTerm,
          limit: 10
        });

        const response = await inventoryAPI.getItems(`?${params}`);
        
        if (response.success) {
          setItems(response.data || []);
        } else {
          setError(response.message || 'Failed to search items');
        }
      } catch (err) {
        setError(err.message);
        console.error('Error searching items:', err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchItems, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleItemSelect = (item) => {
    onItemSelect(item);
    setIsOpen(false);
    setSearchTerm('');
    setItems([]);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
      setItems([]);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
      >
        Add from Catalog
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-300 rounded-md shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Select Item</h3>
              <button
                onClick={handleToggle}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search items..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-500 text-sm mb-4">{error}</div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Searching items...</p>
              </div>
            )}

            {/* Items List */}
            {!loading && items.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemSelect(item)}
                    className="p-3 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        {item.item_code && (
                          <div className="text-sm text-gray-500">Code: {item.item_code}</div>
                        )}
                        {item.description && (
                          <div className="text-sm text-gray-600 mt-1">{item.description}</div>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 ml-2">
                        {item.unit_of_measure || 'PCS'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No Results */}
            {!loading && searchTerm.length >= 2 && items.length === 0 && (
              <div className="text-center py-4">
                <p className="text-gray-500">No items found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Try a different search term or add a free-text item
                </p>
              </div>
            )}

            {/* Search Instructions */}
            {!loading && searchTerm.length < 2 && (
              <div className="text-center py-4">
                <p className="text-gray-500">Type at least 2 characters to search</p>
              </div>
            )}

            {/* Free Text Option */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => handleItemSelect({
                  id: null,
                  name: searchTerm || 'New Item',
                  item_code: '',
                  description: '',
                  unit_of_measure: 'PCS'
                })}
                disabled={!searchTerm.trim()}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add as Free-Text Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemSelector;

