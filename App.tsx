import React, { useState, useRef } from 'react';
import { Plus, Trash2, Upload, Camera, Check, ChevronRight, RefreshCw, Users, Receipt, Calculator, DollarSign, Edit2, Settings } from 'lucide-react';
import { AppStep, PartyMember, ReceiptItem } from './types';
import { parseReceiptImage } from './services/ocr';
import { Button } from './components/Button';
import { Input } from './components/Input';

// --- Helper for ID generation ---
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  // --- State ---
  const [step, setStep] = useState<AppStep>(AppStep.PartyCreation);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([
    { id: generateId(), name: 'You' },
    { id: generateId(), name: '' }
  ]);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState('€');

  // --- Handlers: Step 1 (Party) ---
  const handleAddMember = () => {
    setPartyMembers([...partyMembers, { id: generateId(), name: '' }]);
  };

  const handleRemoveMember = (id: string) => {
    if (partyMembers.length <= 1) return;
    setPartyMembers(partyMembers.filter((m) => m.id !== id));
  };

  const handleMemberNameChange = (id: string, name: string) => {
    setPartyMembers(partyMembers.map((m) => (m.id === id ? { ...m, name } : m)));
  };

  const validateParty = () => {
    const validMembers = partyMembers.filter(m => m.name.trim() !== '');
    if (validMembers.length === 0) {
      setError("Please add at least one person.");
      return;
    }
    setPartyMembers(validMembers);
    setError(null);
    setStep(AppStep.ReceiptUpload);
  };

  // --- Handlers: Step 2 (Upload) ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError("Please upload a valid image file.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = reader.result as string;
        const result = await parseReceiptImage(base64String);
        
        const newItems: ReceiptItem[] = result.items.map(item => ({
          id: generateId(),
          name: item.name,
          price: item.price,
          assignedTo: []
        }));
        
        if (newItems.length === 0) {
           setError("We couldn't detect any items automatically. You can add them manually in the next step.");
           // Proceed anyway with empty list
        }

        setItems(newItems);
        setStep(AppStep.Verification);
      } catch (err) {
        setError("Failed to read receipt text. Please try a clearer photo.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- Handlers: Step 3 (Verification) ---
  const handleUpdateItem = (id: string, field: 'name' | 'price', value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleAddItemManual = () => {
    setItems([...items, { id: generateId(), name: 'New Item', price: 0, assignedTo: [] }]);
  };

  // --- Handlers: Step 4 (Assignment) ---
  const toggleAssignment = (itemId: string, memberId: string) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      
      const isAssigned = item.assignedTo.includes(memberId);
      let newAssigned: string[];
      
      if (isAssigned) {
        newAssigned = item.assignedTo.filter(id => id !== memberId);
      } else {
        newAssigned = [...item.assignedTo, memberId];
      }
      
      return { ...item, assignedTo: newAssigned };
    }));
  };

  const assignAllTo = (memberId: string) => {
    setItems(items.map(item => ({
       ...item,
       assignedTo: item.assignedTo.includes(memberId) ? item.assignedTo : [...item.assignedTo, memberId]
    })));
  }

  // --- Handlers: Step 5 (Summary) ---
  const calculateSummary = () => {
    const summary: Record<string, number> = {};
    partyMembers.forEach(m => summary[m.id] = 0);
    
    let unassignedTotal = 0;

    items.forEach(item => {
      if (item.assignedTo.length === 0) {
        unassignedTotal += item.price;
      } else {
        const splitPrice = item.price / item.assignedTo.length;
        item.assignedTo.forEach(memberId => {
          if (summary[memberId] !== undefined) {
            summary[memberId] += splitPrice;
          }
        });
      }
    });

    return { summary, unassignedTotal };
  };

  const resetApp = () => {
    setStep(AppStep.PartyCreation);
    setItems([]);
    setError(null);
  };


  // --- Render Steps ---

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Who is splitting?</h2>
          <p className="text-slate-500">Add everyone involved in the bill.</p>
        </div>
        
        {/* Currency Selector */}
        <div className="bg-slate-100 rounded-lg px-3 py-2 flex items-center gap-2">
           <label htmlFor="currency-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Currency</label>
           <select 
              id="currency-select"
              value={currency} 
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer text-lg"
            >
              <option value="€">€</option>
              <option value="$">$</option>
              <option value="£">£</option>
              <option value="¥">¥</option>
              <option value="₹">₹</option>
              <option value="kr">kr</option>
           </select>
        </div>
      </div>
      
      <div className="space-y-3">
        {partyMembers.map((member, index) => (
          <div key={member.id} className="flex gap-2 items-center">
            <Input 
              placeholder={`Person ${index + 1}`}
              value={member.name}
              onChange={(e) => handleMemberNameChange(member.id, e.target.value)}
              autoFocus={index === partyMembers.length - 1 && index > 0}
            />
            {partyMembers.length > 1 && (
              <button 
                onClick={() => handleRemoveMember(member.id)}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                aria-label="Remove person"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
        ))}
      </div>

      <Button 
        variant="secondary" 
        fullWidth 
        onClick={handleAddMember}
        className="flex items-center justify-center gap-2 border-dashed"
      >
        <Plus size={18} /> Add Person
      </Button>

      <div className="pt-4">
        <Button fullWidth onClick={validateParty} disabled={partyMembers.every(m => !m.name.trim())}>
          Next: Upload Receipt
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8 text-center">
       <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">Upload Receipt</h2>
        <p className="text-slate-500">Take a photo or upload an image.</p>
      </div>

      <div className="border-2 border-dashed border-indigo-200 rounded-xl p-8 bg-indigo-50/50 hover:bg-indigo-50 transition-colors relative">
        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-600">
            {isProcessing ? <RefreshCw className="animate-spin" size={32}/> : <Camera size={32} />}
          </div>
          <div>
            <p className="font-medium text-indigo-900">
              {isProcessing ? "Reading receipt..." : "Tap to capture or upload"}
            </p>
            {!isProcessing && <p className="text-sm text-indigo-600/70 mt-1">Supports JPG, PNG, WEBP</p>}
          </div>
        </div>
      </div>
      
      {isProcessing && (
        <p className="text-sm text-slate-500 animate-pulse">
          Processing image with OCR... This may take a moment.
        </p>
      )}

       <Button variant="ghost" onClick={() => setStep(AppStep.PartyCreation)}>
          Back
       </Button>
    </div>
  );

  const renderStep3 = () => {
    const currentTotal = items.reduce((sum, item) => sum + item.price, 0);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Verify Items</h2>
          <span className="text-sm font-medium bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
            {items.length} Items
          </span>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex gap-3 items-start">
              <div className="flex-1 space-y-2">
                  <Input 
                    value={item.name} 
                    onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                    className="text-sm font-medium"
                    placeholder="Item Name"
                  />
              </div>
              <div className="w-28 relative">
                  <span className="absolute left-3 top-2 text-slate-400 text-sm pointer-events-none">{currency}</span>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={item.price} 
                    onChange={(e) => handleUpdateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                    className="text-right font-mono pl-6" 
                    placeholder="0.00"
                  />
              </div>
              <button 
                  onClick={() => handleDeleteItem(item.id)}
                  className="mt-2 text-slate-400 hover:text-red-500"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        {/* Total Display */}
        <div className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="font-semibold text-slate-700">Total detected</span>
          <span className="font-mono font-bold text-xl text-indigo-600">{currency}{currentTotal.toFixed(2)}</span>
        </div>

        <Button variant="secondary" fullWidth onClick={handleAddItemManual} className="flex items-center justify-center gap-2">
          <Plus size={16} /> Add Missing Item
        </Button>

        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={() => setStep(AppStep.ReceiptUpload)} className="flex-1">
            Retake
          </Button>
          <Button onClick={() => setStep(AppStep.Assignment)} className="flex-[2]">
            Confirm Items
          </Button>
        </div>
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="space-y-6 pb-24"> {/* pb-24 for sticky footer */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-900">Assign Items</h2>
        <p className="text-slate-500 text-sm">Tap people to assign costs.</p>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <span className="font-semibold text-slate-900">{item.name}</span>
              <span className="font-mono font-bold text-indigo-600">{currency}{item.price.toFixed(2)}</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {partyMembers.map((member) => {
                const isSelected = item.assignedTo.includes(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleAssignment(item.id, member.id)}
                    className={`
                      px-3 py-1.5 rounded-full text-sm font-medium transition-all
                      flex items-center gap-1.5
                      ${isSelected 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                    `}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                    {member.name || 'Unknown'}
                  </button>
                );
              })}
            </div>
            {item.assignedTo.length > 0 && (
               <div className="mt-2 text-xs text-slate-400 text-right">
                 Split {item.assignedTo.length} ways: <span className="font-medium">{currency}{(item.price / item.assignedTo.length).toFixed(2)}</span> each
               </div>
            )}
            {item.assignedTo.length === 0 && (
               <div className="mt-2 text-xs text-amber-600 font-medium text-right flex items-center justify-end gap-1">
                 Unassigned
               </div>
            )}
          </div>
        ))}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg z-10 md:static md:shadow-none md:border-0 md:bg-transparent">
        <div className="max-w-md mx-auto flex gap-3">
            <Button variant="secondary" onClick={() => setStep(AppStep.Verification)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(AppStep.Summary)} className="flex-[2]">Calculate Split</Button>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => {
    const { summary, unassignedTotal } = calculateSummary();
    const totalSpent = items.reduce((sum, i) => sum + i.price, 0);

    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 text-green-600 rounded-full mb-4">
             <span className="text-2xl font-bold">{currency}</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Final Split</h2>
          <p className="text-slate-500">Total Bill: {currency}{totalSpent.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-sm">
          {partyMembers.map(member => {
            const amount = summary[member.id] || 0;
            return (
              <div key={member.id} className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                     {member.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-slate-900">{member.name}</span>
                </div>
                <span className="font-mono font-bold text-lg text-slate-900">
                  {currency}{amount.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>

        {unassignedTotal > 0.01 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
             <div className="mt-1 text-amber-600">
               <Calculator size={18} />
             </div>
             <div>
               <p className="font-bold text-amber-800">Unassigned Amount: {currency}{unassignedTotal.toFixed(2)}</p>
               <p className="text-sm text-amber-700">Go back to assign these remaining costs.</p>
             </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={() => setStep(AppStep.Assignment)} fullWidth>
            Edit Assignments
          </Button>
          <Button onClick={resetApp} fullWidth>
            Start Over
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-md mx-auto min-h-screen flex flex-col bg-white shadow-xl md:my-8 md:min-h-0 md:rounded-2xl md:overflow-hidden">
        
        {/* Header */}
        <header className="bg-white border-b border-slate-100 p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 text-indigo-600">
            <Receipt className="w-6 h-6" />
            <h1 className="font-bold text-lg tracking-tight">FairShare</h1>
          </div>
          <div className="flex gap-1">
             {[1, 2, 3, 4, 5].map((s) => (
                <div 
                  key={s} 
                  className={`h-1.5 w-6 rounded-full transition-colors ${step >= s ? 'bg-indigo-600' : 'bg-slate-200'}`} 
                />
             ))}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm flex items-start gap-2">
               <span className="font-bold">Error:</span> {error}
            </div>
          )}
          
          {step === AppStep.PartyCreation && renderStep1()}
          {step === AppStep.ReceiptUpload && renderStep2()}
          {step === AppStep.Verification && renderStep3()}
          {step === AppStep.Assignment && renderStep4()}
          {step === AppStep.Summary && renderStep5()}
        </main>
      </div>
    </div>
  );
}