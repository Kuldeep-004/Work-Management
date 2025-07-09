import { useState, useEffect } from 'react';

const Notes = () => {
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  // Load note from localStorage on mount
  useEffect(() => {
    const userId = localStorage.getItem('userId') || 'guest';
    const savedNote = localStorage.getItem(`note_${userId}`);
    if (savedNote) setNote(savedNote);
  }, []);

  // Auto-save note to localStorage
  useEffect(() => {
    const timeout = setTimeout(() => {
      const userId = localStorage.getItem('userId') || 'guest';
      localStorage.setItem(`note_${userId}`, note);
      setSaved(true);
      setTimeout(() => setSaved(false), 1000);
    }, 500);
    return () => clearTimeout(timeout);
  }, [note]);

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
        <span className="text-xs text-gray-400">Your notes are private and saved only for you.</span>
      </div>
    </div>
  );
};

export default Notes; 