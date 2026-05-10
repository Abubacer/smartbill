/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Droplets, 
  Calculator, 
  RefreshCcw, 
  Copy, 
  Camera, 
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Share2,
  ExternalLink
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface BillData {
  // Electricity
  consumptionKwh: string;
  ePre: string;
  eCur: string;
  tranche1: string;
  tranche2: string;
  redFixeElec: string;
  tva: string;
  
  // Water
  consumptionM3: string;
  wPre: string;
  wCur: string;
  wM3: string;
  redFixeAssainissement: string;
  assainissement: string;
  redFixeEau: string;

  // Payments
  pMe: string;
  pNbr: string;
}

const initialData: BillData = {
  consumptionKwh: '',
  ePre: '',
  eCur: '',
  tranche1: '',
  tranche2: '',
  redFixeElec: '',
  tva: '',
  consumptionM3: '',
  wPre: '',
  wCur: '',
  wM3: '',
  redFixeAssainissement: '',
  assainissement: '',
  redFixeEau: '',
  pMe: '',
  pNbr: ''
};

export default function App() {
  const [data, setData] = useState<BillData>(initialData);
  const [report, setReport] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setData(prev => ({ ...prev, [id]: value }));
  };

  const resetForm = () => {
    setData(initialData);
    setReport(null);
    setError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!process.env.GEMINI_API_KEY) {
      setError("يرجى ضبط مفتاح API الخاص بـ Gemini في الإعدادات.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;
      const base64String = base64Data.split(',')[1];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                text: `Extract data from this Moroccan electricity (LYDEC, REDAL, AMENDIS, AMENDIS, RADEEMA, etc.) or water bill. 
                Instruction:
                1. Handle bilingual labels (Arabic/French).
                2. If numeric values use commas (e.g., 12,50), convert them to dots (12.50).
                3. Look for "Consommation" or "إستهلاك" for KWh/m3 values.
                4. Look for "NET A PAYER" or "المبلغ الواجب أداؤه" for total payment.
                5. Keep existing values if not found in this new bill.

                Look for these fields specifically:
                - Total Electricity Consumption in KWh (Consommation Electricité / إستهلاك الكهرباء)
                - Tranche 1 amount (Tranche 1 / الشطر 1)
                - Tranche 2 amount (Tranche 2 / الشطر 2)
                - Fixed electricity fee (Redevance Fixe Electricité / إتاوة ثابتة الكهرباء)
                - VAT (TVA / الضريبة على القيمة المضافة)
                - Total Water Consumption in m3 (Consommation Eau / إستهلاك الماء)
                - Price per m3 (Prix Unit./Unit. m3 / ثمن المتر الواحد / سعر الوحدة)
                - Sanitation/Sewerage fee (Redevance Assainissement / التطهير)
                - Fixed water fee (Redevance Fixe Eau / إتاوة ثابتة الماء)
                - Fixed sanitation fee (Redevance Fixe Assainissement / إتاوة ثابتة التطهير)
                - Total to pay (Total à Payer / المجموع الواجب أداءه / NET A PAYER)
                
                Return ONLY a JSON object with these keys: 
                consumptionKwh, tranche1, tranche2, redFixeElec, tva, consumptionM3, wM3, assainissement, redFixeEau, redFixeAssainissement, totalAPayer.
                Use numbers as strings. If a value is not found on THIS bill, return null for that key.`
              },
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64String
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      setData(prev => {
        const next = { ...prev };
        if (result.consumptionKwh !== undefined && result.consumptionKwh !== null) next.consumptionKwh = result.consumptionKwh;
        if (result.tranche1 !== undefined && result.tranche1 !== null) next.tranche1 = result.tranche1;
        if (result.tranche2 !== undefined && result.tranche2 !== null) next.tranche2 = result.tranche2;
        if (result.redFixeElec !== undefined && result.redFixeElec !== null) next.redFixeElec = result.redFixeElec;
        if (result.tva !== undefined && result.tva !== null) next.tva = result.tva;
        
        if (result.consumptionM3 !== undefined && result.consumptionM3 !== null) next.consumptionM3 = result.consumptionM3;
        if (result.wM3 !== undefined && result.wM3 !== null) next.wM3 = result.wM3;
        if (result.assainissement !== undefined && result.assainissement !== null) next.assainissement = result.assainissement;
        if (result.redFixeEau !== undefined && result.redFixeEau !== null) next.redFixeEau = result.redFixeEau;
        if (result.redFixeAssainissement !== undefined && result.redFixeAssainissement !== null) next.redFixeAssainissement = result.redFixeAssainissement;

        // Auto-fill payments based on detected bill type
        if (result.totalAPayer) {
          if (result.consumptionKwh && result.consumptionKwh !== "0") {
            next.pMe = result.totalAPayer;
          } else if (result.consumptionM3 && result.consumptionM3 !== "0") {
            next.pNbr = result.totalAPayer;
          }
        }
        
        return next;
      });

    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء معالجة الصورة. حاول مرة أخرى.");
    } finally {
      setIsProcessing(false);
      // Clear input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const calculate = () => {
    const {
      consumptionKwh, ePre, eCur, tranche1, tranche2, redFixeElec, tva,
      consumptionM3, wPre, wCur, wM3, redFixeAssainissement, assainissement, redFixeEau,
      pMe, pNbr
    } = data;

    const KwhVal = parseFloat(consumptionKwh) || 0;
    const ePreVal = parseFloat(ePre) || 0;
    const eCurVal = parseFloat(eCur) || 0;
    const T1Val = parseFloat(tranche1) || 0;
    const T2Val = parseFloat(tranche2) || 0;
    const redElecVal = parseFloat(redFixeElec) || 0;
    const tvaVal = parseFloat(tva) || 0;

    const M3Val = parseFloat(consumptionM3) || 0;
    const wPreVal = parseFloat(wPre) || 0;
    const wCurVal = parseFloat(wCur) || 0;
    const wM3Val = parseFloat(wM3) || 0;
    const redAssainVal = parseFloat(redFixeAssainissement) || 0;
    const assainVal = parseFloat(assainissement) || 0;
    const redEauVal = parseFloat(redFixeEau) || 0;

    const pMeVal = parseFloat(pMe) || 0;
    const pNbrVal = parseFloat(pNbr) || 0;

    if (KwhVal === 0 && M3Val === 0) {
      setError("يرجى إدخال قيم الاستهلاك على الأقل.");
      return;
    }

    // Electricity logic
    const myE = eCurVal - ePreVal;
    const nbrE = KwhVal - myE;
    const totalElecCost = T1Val + T2Val;
    const pricePerKwh = KwhVal > 0 ? totalElecCost / KwhVal : 0;
    const totalElecFees = redElecVal + tvaVal;
    const myElecPrice = (pricePerKwh * myE) + (totalElecFees / 2);
    const nbrElecPrice = (pricePerKwh * nbrE) + (totalElecFees / 2);

    // Water logic
    const myW = wCurVal - wPreVal;
    const nbrW = M3Val - myW;
    const totalWaterFees = redAssainVal + assainVal + redEauVal;
    const myWaterPrice = (wM3Val * myW) + (totalWaterFees / 2);
    const nbrWaterPrice = (wM3Val * nbrW) + (totalWaterFees / 2);

    const myTotal = myElecPrice + myWaterPrice;
    const nbrTotal = nbrElecPrice + nbrWaterPrice;
    
    // Payments diff
    const diffNbr = nbrTotal - pNbrVal;
    const diffMe = pMeVal - myTotal;

    const generatedReport = `الاستهلاك ديال هاد الشهر هو: ${KwhVal.toFixed(1)} kw

الاستهلاك ديالي لهاد الشهر هو:
${eCurVal} - ${ePreVal} = ${myE.toFixed(1)} kw

الاستهلاك ديالك لهاد الشهر هو:
${KwhVal} - ${myE.toFixed(1)} = ${nbrE.toFixed(1)} kw

الشطر 1 + الشطر 2:
${T1Val} + ${T2Val} = ${totalElecCost.toFixed(2)} dh

تمن لكيلوواط هو:
${totalElecCost.toFixed(2)} / ${KwhVal} = ${pricePerKwh.toFixed(6)} dh

إتاوة ثابتة + الضريبة:
${totalElecFees.toFixed(2)} / 2 = ${(totalElecFees / 2).toFixed(2)} dh

المجموع ضو ديالي:
(${pricePerKwh.toFixed(6)} × ${myE.toFixed(1)}) + ${(totalElecFees / 2).toFixed(2)} = ${myElecPrice.toFixed(2)} dh

المجموع ضو ديالك:
(${pricePerKwh.toFixed(6)} × ${nbrE.toFixed(1)}) + ${(totalElecFees / 2).toFixed(2)} = ${nbrElecPrice.toFixed(2)} dh

----------------------------
استهلاك الماء هاد الشهر: ${M3Val.toFixed(1)} m³

الاستهلاك ديالي هو:
${wCurVal} - ${wPreVal} = ${myW.toFixed(1)} m³

تمن المتر المكعب: ${wM3Val.toFixed(2)} dh

الرسوم + الضريبة + التطهير:
${totalWaterFees.toFixed(2)} / 2 = ${(totalWaterFees / 2).toFixed(2)} dh

المجموع ديالي ديال الماء:
(${wM3Val.toFixed(2)} × ${myW.toFixed(1)}) + ${(totalWaterFees / 2).toFixed(2)} = ${myWaterPrice.toFixed(2)} dh

استهلاك ديالك ماء: ${nbrW.toFixed(1)} m³
المجموع ديالك ماء هو:
(${wM3Val.toFixed(2)} × ${nbrW.toFixed(1)}) + ${(totalWaterFees / 2).toFixed(2)} = ${nbrWaterPrice.toFixed(2)} dh

----------------------------
مجموع ضو + ماء ديالي:
${myElecPrice.toFixed(2)} + ${myWaterPrice.toFixed(2)} = ${myTotal.toFixed(2)} dh

مجموع ضو + ماء ديالك:
${nbrElecPrice.toFixed(2)} + ${nbrWaterPrice.toFixed(2)} = ${nbrTotal.toFixed(2)} dh

نتا خلصتي لفاكتورة ديال ماء ب ${pNbrVal.toFixed(2)} dh
و خاصك تخلص مجموع ضو + ماء ديالك ${nbrTotal.toFixed(2)} dh
إذن خاصك تزيد لي: ${diffNbr.toFixed(2)} dh

أنا خلصت لفاكتورة ديال ضو ب ${pMeVal.toFixed(2)} dh
و خاص نخلص مجموع ضو + ماء ديالي ${myTotal.toFixed(2)} dh
إذن الباقي لي: ${diffMe.toFixed(2)} dh

الخلاصة: خاصك ترجع لي ${diffNbr.toFixed(2)} درهم.`;

    setReport(generatedReport);
  };

  const copyToClipboard = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      alert("تم نسخ التقرير بنجاح!");
    }
  };

  const shareToWhatsApp = () => {
    if (report) {
      const encodedText = encodeURIComponent(report);
      const url = `https://wa.me/?text=${encodedText}`;
      window.open(url, '_blank', 'noreferrer');
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100 flex flex-col font-sans selection:bg-brand-glow/30 overflow-x-hidden relative" dir="rtl">
      {/* Background Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-glow/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-accent to-brand-glow flex items-center justify-center neon-shadow">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">Smart Bill Hub</h1>
            <span className="text-[10px] text-brand-accent uppercase font-bold tracking-widest leading-none">Futuristic Auditor</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] font-mono">Consolidated Analysis System v2.0</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 container mx-auto">
        
        {/* Sidebar / Section 1 */}
        <section className="lg:col-span-4 flex flex-col gap-8">
          
          {/* OCR Upload Card */}
          <div className="glass-card rounded-[2.5rem] p-8 flex flex-col h-fit relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 blur-3xl -mr-10 -mt-10 group-hover:bg-brand-accent/10 transition-all" />
            
            <h2 className="text-[10px] font-black text-slate-500 mb-6 flex items-center gap-2 uppercase tracking-[0.2em] relative z-10">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_8px_#00d2ff]" />
              Scan Analytics
            </h2>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`relative border border-white/5 rounded-3xl py-12 flex flex-col items-center justify-center gap-4 bg-brand-bg/40 hover:bg-white/5 hover:border-brand-accent/30 transition-all duration-500 cursor-pointer group/upload ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center border border-white/5 group-hover/upload:scale-110 group-hover/upload:border-brand-accent/50 transition-all duration-700 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                {isProcessing ? (
                  <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
                ) : (
                  <Camera className="w-10 h-10 text-brand-accent drop-shadow-[0_0_8px_rgba(0,210,255,0.5)]" />
                )}
              </div>
              <div className="text-center px-4">
                <p className="text-sm font-bold text-white group-hover/upload:text-brand-accent transition-colors">ارفع الفاتورة الذكي</p>
                <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-widest font-mono">JPG, PNG or PDF</p>
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*,.pdf"
            />

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center gap-3 text-[10px] text-red-400 font-bold"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <div className="mt-8 space-y-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-600">Core Status</span>
                <span className={isProcessing ? "text-brand-accent animate-pulse" : "text-emerald-500"}>
                  {isProcessing ? "PROCESSING..." : "IDLE"}
                </span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden shadow-inner flex items-center p-[2px]">
                <motion.div 
                  className="bg-brand-accent h-full rounded-full shadow-[0_0_12px_#00d2ff]"
                  initial={{ width: 0 }}
                  animate={{ width: isProcessing ? '85%' : '0%' }}
                  transition={{ duration: 1.5, repeat: isProcessing ? Infinity : 0 }}
                />
              </div>
            </div>
          </div>

          {/* Payments Card */}
          <div className="glass-card rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden">
            <h2 className="text-[10px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              Payment Modules
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <InputField id="pMe" label="الأداء الشخصي (كهرباء)" value={data.pMe} onChange={handleChange} placeholder="0.00" />
              <InputField id="pNbr" label="الأداء الشخصي (ماء)" value={data.pNbr} onChange={handleChange} placeholder="0.00" />
            </div>
            <div className="pt-2">
              <button
                onClick={resetForm}
                className="w-full flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all duration-300 text-slate-500 hover:text-red-400 group"
              >
                <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />
                <span>Format All Data</span>
              </button>
            </div>
          </div>
        </section>

        {/* Consumption Data / Section 2 */}
        <section className="lg:col-span-8 flex flex-col gap-8">
          <div className="glass-card rounded-[3rem] p-8 lg:p-12 h-full flex flex-col relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl -mr-20 -mb-20 pointer-events-none" />
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white tracking-tighter">Main Processor</h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Quantum Consumption Analysis Hub</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-16">
              {/* Electricity Section */}
              <div className="space-y-8">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-[1.25rem] bg-brand-accent/10 flex items-center justify-center border border-brand-accent/20 neon-shadow">
                    <Zap className="w-7 h-7 text-brand-accent drop-shadow-[0_0_8px_rgba(0,210,255,0.8)]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Power Matrix</h3>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Electrical Load Distribution</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="md:col-span-2">
                    <InputField id="consumptionKwh" label="الاستهلاك الكلي للفاتورة (kWh)" value={data.consumptionKwh} onChange={handleChange} placeholder="0" highlight />
                  </div>
                  
                  <div className="p-8 bg-black/20 rounded-[2rem] border border-white/5 space-y-8 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)]">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] flex items-center gap-2">
                      <div className="w-1 h-3 bg-brand-accent rounded-full" />
                      Meter Readings
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      <InputField id="eCur" label="Current" value={data.eCur} onChange={handleChange} placeholder="0" />
                      <InputField id="ePre" label="Previous" value={data.ePre} onChange={handleChange} placeholder="0" />
                    </div>
                  </div>

                  <div className="p-8 bg-black/20 rounded-[2rem] border border-white/5 space-y-8 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)]">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] flex items-center gap-2">
                      <div className="w-1 h-3 bg-brand-accent rounded-full" />
                      Unit Pricing
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      <InputField id="tranche1" label="Tier 1" value={data.tranche1} onChange={handleChange} placeholder="0.00" />
                      <InputField id="tranche2" label="Tier 2" value={data.tranche2} onChange={handleChange} placeholder="0.00" />
                    </div>
                  </div>

                  <InputField id="redFixeElec" label="إتاوة ثابتة" value={data.redFixeElec} onChange={handleChange} placeholder="0.00" />
                  <InputField id="tva" label="الضريبة (TVA)" value={data.tva} onChange={handleChange} placeholder="0.00" />
                </div>
              </div>

              {/* Water Section */}
              <div className="space-y-8">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-[1.25rem] bg-brand-glow/10 flex items-center justify-center border border-brand-glow/20">
                    <Droplets className="w-7 h-7 text-brand-glow drop-shadow-[0_0_8px_rgba(58,134,255,0.5)]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Fluid Core</h3>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Hydraulic Resource Management</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="md:col-span-2">
                    <InputField id="consumptionM3" label="استهلاك الماء الكلي (m³)" value={data.consumptionM3} onChange={handleChange} placeholder="0" highlight />
                  </div>

                  <div className="p-8 bg-black/20 rounded-[2rem] border border-white/5 space-y-8 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)]">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] flex items-center gap-2">
                      <div className="w-1 h-3 bg-brand-glow rounded-full" />
                      Flow Analytics
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      <InputField id="wCur" label="Current" value={data.wCur} onChange={handleChange} placeholder="0" />
                      <InputField id="wPre" label="Previous" value={data.wPre} onChange={handleChange} placeholder="0" />
                    </div>
                  </div>

                  <div className="p-8 bg-black/20 rounded-[2rem] border border-white/5 space-y-8 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)]">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] flex items-center gap-2">
                      <div className="w-1 h-3 bg-brand-glow rounded-full" />
                      Rate Matrix
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      <InputField id="wM3" label="Rate/m³" value={data.wM3} onChange={handleChange} placeholder="0.00" />
                      <InputField id="redFixeEau" label="Fixed Fee" value={data.redFixeEau} onChange={handleChange} placeholder="0.00" />
                    </div>
                  </div>

                  <InputField id="redFixeAssainissement" label="إتاوة التطهير" value={data.redFixeAssainissement} onChange={handleChange} placeholder="0.00" />
                  <InputField id="assainissement" label="التطهير السائل" value={data.assainissement} onChange={handleChange} placeholder="0.00" />
                </div>
              </div>
            </div>

            <div className="mt-12 pt-10 border-t border-white/5">
              <button
                onClick={calculate}
                className="w-full py-6 bg-gradient-to-r from-brand-accent to-brand-glow hover:brightness-125 text-white text-xl font-black rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,210,255,0.3)] active:scale-[0.98] transition-all duration-500 flex items-center justify-center gap-5 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <Calculator className="w-8 h-8 group-hover:scale-125 transition-transform duration-500" />
                <span className="tracking-widest uppercase">Sync & Generate Report</span>
              </button>
            </div>
          </div>
        </section>
      </main>


      {/* Report Modal/Overlay */}
      <AnimatePresence>
        {report && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          >
            <motion.div 
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              className="absolute inset-0 bg-brand-bg/60" 
              onClick={() => setReport(null)} 
            />
            
            <motion.div
              layoutId="report-modal"
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="relative w-full max-w-2xl max-h-[90vh] glass-card rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 shadow-[0_0_10px_#10b981]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Data Finalized</h3>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest font-mono">Consolidated Report</p>
                  </div>
                </div>
                <button 
                  onClick={() => setReport(null)}
                  className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/5"
                >
                  <RefreshCcw className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto custom-scrollbar text-right">
                <div className="bg-black/40 p-8 rounded-[2rem] border border-white/5 font-mono text-sm leading-relaxed text-slate-300 whitespace-pre-wrap select-all shadow-inner">
                  {report}
                </div>
              </div>

              <div className="p-8 bg-white/[0.02] border-t border-white/5 flex flex-col sm:flex-row gap-5">
                <button
                  onClick={shareToWhatsApp}
                  className="flex-1 flex items-center justify-center gap-3 py-5 bg-emerald-600 hover:bg-emerald-500 hover:brightness-110 text-white rounded-[1.5rem] transition-all font-black uppercase tracking-widest shadow-xl shadow-emerald-900/40 group text-xs"
                >
                  <Share2 className="w-6 h-6 group-hover:scale-125 transition-transform" />
                  إرسال عبر واتساب
                </button>
                <button
                  onClick={copyToClipboard}
                  className="flex-1 flex items-center justify-center gap-3 py-5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-[1.5rem] transition-all font-black uppercase tracking-widest border border-white/5 text-xs"
                >
                  <Copy className="w-6 h-6" />
                  نسخ النص فقط
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-6 px-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-[1px] bg-gradient-to-r from-transparent via-brand-accent/30 to-transparent" />
        <div>Quantum Billing Processor v2.0.4</div>
        <div className="flex gap-8 mt-4 md:mt-0">
          <span className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-emerald-500" /> CALC_ACCURACY: 1.000</span>
          <span className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-brand-accent" /> SYSTEM_OS: FUTURE_LIGHT_OS</span>
        </div>
      </footer>
</div>
  );
}

function InputField({ id, label, value, onChange, placeholder, highlight = false }: { id: string, label: string, value: string, onChange: any, placeholder?: string, highlight?: boolean }) {
  return (
    <div className="space-y-2 group">
      <label htmlFor={id} className="block text-[10px] font-black uppercase tracking-widest text-slate-500 group-focus-within:text-brand-accent transition-colors">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          step="any"
          className={`w-full bg-white/5 border ${highlight ? 'border-brand-accent/50 shadow-[0_0_10px_rgba(0,210,255,0.1)]' : 'border-white/5'} rounded-xl p-3 text-sm transition-all focus:outline-none focus:border-brand-accent focus:bg-white/10 font-mono placeholder:text-slate-700 text-white shadow-inner`}
        />
        {highlight && (
          <div className="absolute inset-0 rounded-xl border border-brand-accent/20 pointer-events-none group-focus-within:border-brand-accent/50 transition-colors" />
        )}
      </div>
    </div>
  );
}
