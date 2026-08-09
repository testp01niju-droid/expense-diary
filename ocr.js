/* ocr.js - High-accuracy OCR + Bulk Routing */
(function() {
  const OCR_API_KEY = 'K85538498888957'; // ← Replace after Step 1
  let currentImage = null;

  // Canvas Preprocessing: Grayscale + Contrast + DPI Scale
  function preprocessImage(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = Math.max(1, 1800 / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for(let i=0; i<d.length; i+=4){
          let g = d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
          g = g > 140 ? 255 : 0;
          d[i] = d[i+1] = d[i+2] = g;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }

  // OCR.Space API Call
  async function callOCR(processedImg) {
    const fd = new FormData();
    fd.append('base64Image', processedImg);
    fd.append('language', 'eng+tam');
    fd.append('isOverlayRequired', 'false');
    fd.append('scale', 'true');
    fd.append('isTable', 'true');
    fd.append('detectOrientation', 'true');

    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'apikey': OCR_API_KEY },
      body: fd
    });
    const json = await res.json();
    if(json.OCRExitCode !== 1) throw new Error(json.ErrorMessage?.join(', ') || 'OCR API failed');
    return json.ParsedResults[0].ParsedText;
  }

  // Line Parser → Bulk Format
  function parseToBulk(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 2);
    const entries = [];
    const today = new Date().toISOString().split('T')[0];
    const catMap = {
      food: /food|lunch|dinner|breakfast|tea|coffee|சாப்பாடு|உணவு|பிரியாணி|டீ|காபி|rice|dosa|meal/i,
      transport: /transport|bus|train|auto|uber|ola|பேருந்து|ரயில்|ஆட்டோ|பயணம்|fare|ticket/i,
      shopping: /shop|purchase|buy|grocery|supermarket|கடை|மளிகை|வாங்கு|mart|store/i,
      bills: /bill|electricity|water|mobile|recharge|மின்சாரம்|தண்ணீர்|பில்|eb|current/i,
      health: /health|medicine|doctor|hospital|மருந்து|மருத்துவம்|ஆஸ்பத்திரி|pharmacy|clinic/i,
      education: /education|school|college|fee|tuition|பள்ளி|கல்லூரி|கட்டணம்|book|exam/i,
      entertainment: /entertainment|movie|cinema|game|படம்|சினிமா|விளையாட்டு|recharge|ott/i,
      rent: /rent|house|lease|வாடகை|வீடு|owner|pg|hostel/i
    };

    lines.forEach(line => {
      const amtMatch = line.match(/₹\s*([\d,]+\.?\d*)/i) || line.match(/rs\.?\s*([\d,]+\.?\d*)/i) || line.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
      if(!amtMatch) return;
      const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
      if(amount <= 0) return;

      const dtMatch = line.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
      let date = today;
      if(dtMatch){
        let y = dtMatch[3].length===2 ? '20'+dtMatch[3] : dtMatch[3];
        date = `${y}-${dtMatch[2].padStart(2,'0')}-${dtMatch[1].padStart(2,'0')}`;
      }

      let category = 'others';
      for(const [cat, regex] of Object.entries(catMap)){
        if(regex.test(line)){ category = cat; break; }
      }

      const desc = line.replace(/₹|rs\.?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|[\/\-\.]\d{1,4}/gi, '').trim().substring(0, 80);
      entries.push({ date, category, amount, description: desc || category });
    });
    return entries;
  }

  // UI Helpers
  const $ = id => document.getElementById(id);
  function showStep(n){ for(let i=1;i<=4;i++) if($('os'+i)) $('os'+i).style.display = i===n?'block':'none'; }
  function resetOCR(){ currentImage=null; showStep(1); if($('opb'))$('opb').style.width='0%'; if($('opc'))$('opc').textContent='0%'; if($('oet'))$('oet').value=''; }

  // Bind Events
  window.initOCR = function(){
    if(!$('otg')) return;
    $('otg').onclick = ()=>{
      if(!navigator.onLine){ alert('OCR requires internet.'); return; }
      resetOCR(); if($('moc')) $('moc').classList.add('sh');
    };
    if($('ox')) $('ox').onclick = ()=> $('moc').classList.remove('sh');
    if($('moc')) $('moc').onclick = e=>{ if(e.target===e.currentTarget) $('moc').classList.remove('sh'); };
    if($('ocm')) $('ocm').onclick = ()=>{ const f=$('ofi'); f.setAttribute('capture','environment'); f.click(); };
    if($('oup')) $('oup').onclick = ()=>{ const f=$('ofi'); f.removeAttribute('capture'); f.click(); };
    if($('ofi')) $('ofi').onchange = e=>{
      const file=e.target.files[0]; if(!file) return;
      const r=new FileReader();
      r.onload=ev=>{ currentImage=ev.target.result; if($('opv'))$('opv').src=currentImage; showStep(2); };
      r.readAsDataURL(file); e.target.value='';
    };
    if($('ort')) $('ort').onclick = resetOCR;
    if($('opr')) $('opr').onclick = async ()=>{
      if(!currentImage) return;
      showStep(3);
      try{
        const processed = await preprocessImage(currentImage);
        const rawText = await callOCR(processed);
        const bulkEntries = parseToBulk(rawText);
        if(bulkEntries.length === 0){ alert('No valid expenses detected. Try a clearer image.'); resetOCR(); return; }
        
        // Route to Bulk Preview
        const bulkText = bulkEntries.map(e => `${e.date},${e.category},${e.amount},${e.description}`).join('\n');
        const bulkTA = document.getElementById('bulkTextarea') || document.querySelector('textarea[placeholder*="bulk"]') || document.querySelector('textarea[rows="4"]');
        if(bulkTA){
          bulkTA.value = bulkText;
          const parseBtn = document.getElementById('parseBulkBtn') || document.querySelector('button[onclick*="parse"]') || document.querySelector('button:has-text("Parse")');
          if(parseBtn) parseBtn.click();
        }
        if($('moc')) $('moc').classList.remove('sh');
        if(typeof sTab === 'function') sTab('1');
        alert('OCR done. Review in bulk preview.');
      }catch(e){
        console.error(e);
        alert('OCR failed: ' + e.message);
        resetOCR();
      }
    };
    if($('odi')) $('odi').onclick = ()=> $('moc').classList.remove('sh');
  };
})();