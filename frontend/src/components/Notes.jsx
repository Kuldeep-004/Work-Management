import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';
import toast from 'react-hot-toast';

const Notes = () => {
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load note from MongoDB on mount
  useEffect(() => {
    const fetchNote = async () => {
      if (!user?.token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/notes`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setNote(data.content || '');
        } else {
          console.error('Failed to fetch note');
        }
      } catch (error) {
        console.error('Error fetching note:', error);
        toast.error('Failed to load your notes');
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [user]);

  // Auto-save note to MongoDB
  useEffect(() => {
    if (!user?.token || loading) return;

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({ content: note }),
        });

        if (response.ok) {
          setSaved(true);
          setTimeout(() => setSaved(false), 1000);
        } else {
          console.error('Failed to save note');
        }
      } catch (error) {
        console.error('Error saving note:', error);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [note, user, loading]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg border border-gray-200 animate-fade-in">
      <h2 className="text-2xl font-bold mb-4 text-blue-700 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
        My Notes
      </h2>
      <textarea
        className="w-full min-h-[250px] p-4 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg transition-all resize-vertical bg-blue-50 placeholder-gray-400"
        placeholder="Write anything here..."
        value={note}
        onChange={e => setNote(e.target.value)}
        spellCheck={true}
        autoFocus
      />
      <div className="flex justify-between items-center mt-2">
        <span className={`text-xs ${saved ? 'text-green-600' : 'text-gray-400'} transition-all`}>
          {saved ? 'Saved!' : 'Auto-saving...'}
        </span>
        <span className="text-xs text-gray-400">Your notes are private and saved securely in the cloud.</span>
      </div>
    </div>
  );
};

export default Notes; 