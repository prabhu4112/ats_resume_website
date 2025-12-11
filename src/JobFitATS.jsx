import React, { useState, useRef, useEffect } from "react";

// JobFit ATS — Updated Integrated Component
// Improvements made:
// - Safer company extraction (avoids salary lines)
// - Clean, human-friendly summary generation
// - Prefer resume's Skills: line; fallback filtered keywords
// - Project/Experience bullets generated as short bullets (no long paragraph dumps)
// - Better preview HTML (ul bullets) and CSS for cleaner PDF output
// - PDF export uses html2canvas scale:3 and backgroundColor:'#ffffff' for crisper PDF

export default function JobFitATSIntegrated() {
  const [resumeText, setResumeText] = useState(`Prabhu\nSkills: JavaScript, HTML, CSS\nEducation: B.Tech`);
  const [jobDescText, setJobDescText] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [autoCompany, setAutoCompany] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [matchedSentences, setMatchedSentences] = useState([]);
  const [initialScore, setInitialScore] = useState(null);
  const [postScore, setPostScore] = useState(null);
  const [intensity, setIntensity] = useState(null); // 'low'|'moderate'|'high'
  const [notes, setNotes] = useState([]);
  const [showPlan, setShowPlan] = useState(false);
  const previewRef = useRef();

  // ----- utilities -----
  function norm(t) { return (t||'').toLowerCase(); }

  function extractKeywords(text, topN=30) {
    if (!text) return [];
    const stop = new Set(['a','an','the','and','or','in','on','at','for','with','to','from','by','is','are','be','this','that','of','as','it','will','you','your','we','our','i','me','skills','responsibilities','experience','years']);
    const words = text.replace(/[\n,.;:()\[\]\/\\\-]/g,' ').toLowerCase().split(/\s+/).filter(w=>w.length>2 && !stop.has(w));
    const freq = {};
    for (const w of words) freq[w] = (freq[w]||0)+1;
    return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,topN).map(x=>x[0]);
  }

  function splitSentences(text) { return (text||'').split(/(?<=[.!?\n])\s+/).map(s=>s.trim()).filter(Boolean); }

  function computeScore(resume, jdKeywords) {
    if (!jdKeywords || jdKeywords.length === 0) return 0;
    const r = norm(resume);
    const found = jdKeywords.filter(k => r.includes(k));
    return Math.round((found.length / jdKeywords.length) * 100);
  }

  // intensity detection lists
  const heavyKeywords = ['algorithm','data structures','system design','distributed','concurrency','multithread','profiling','latency','throughput','advanced','low-level','c++','rust','compiler','scalability','grpc','real-time','deep learning','research','phd'];
  const moderateKeywords = ['api','rest','backend','node','java','python','django','spring','react','angular','vue','sql','database','ci/cd','docker','devops','automation','scripting','bash','shell','aws','azure','gcp'];
  const lightKeywords = ['basic','entry','fresher','intern','support','excel','data entry','documentation','testing','manual testing','helpdesk','no coding'];

  function analyzeIntensity(jd) {
    const t = norm(jd);
    let heavy=0, mod=0, light=0;
    for (const k of heavyKeywords) if (t.includes(k)) heavy++;
    for (const k of moderateKeywords) if (t.includes(k)) mod++;
    for (const k of lightKeywords) if (t.includes(k)) light++;

    if (heavy >= 2 || mod >= 5) return 'high';
    if (mod >= 2 || heavy === 1) {
      if (/devops|ci\/cd|docker|kubernetes|automation|scripting/.test(t) && heavy === 0) return 'moderate';
      return 'moderate';
    }
    if (light >= 1 || (mod===0 && heavy===0)) return 'low';
    return 'moderate';
  }

  function sanitizeCompany(name) {
    return (name || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/[^\w\s&.\-]/g, '').trim();
  }

  function extractCompanyName(jd) {
    if (!jd) return '';
    const lines = jd.split(/\n+/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^company\b/i.test(line) && /[A-Z]/.test(line)) {
        const parts = line.split(/[:\-–]/);
        const maybe = parts.slice(1).join(':').trim();
        if (maybe && !/\d|₹|lpa|per month|salary/i.test(maybe)) return sanitizeCompany(maybe);
      }
    }
    const atMatch = /(?:at\s+)([A-Z][A-Za-z0-9&.\- ]{2,60})/m.exec(jd);
    if (atMatch && !/\d|₹|lpa|per month|salary/i.test(atMatch[1])) return sanitizeCompany(atMatch[1].trim());
    const isAMatch = /([A-Z][A-Za-z0-9&.\- ]{2,60})\s+is\s+a/i.exec(jd);
    if (isAMatch && !/\d|₹|lpa|per month|salary/i.test(isAMatch[1])) return sanitizeCompany(isAMatch[1].trim());
    for (const line of lines) {
      const candidate = line.split(/[-:|]/)[0].trim();
      if (/[A-Za-z]/.test(candidate) && !/\d|₹|lpa|per month|salary/i.test(candidate) && candidate.length < 40) {
        return sanitizeCompany(candidate);
      }
    }
    return '';
  }

  function extractResumeSkills(resume) {
    const m = /skills?:\s*(.+)/i.exec(resume);
    if (m && m[1]) {
      return m[1].split(/[,•|;]/).map(s => s.trim()).filter(Boolean);
    }
    const kws = extractKeywords(resume, 20).filter(k => !/apply|job|company|companies|career|start|their|the|role/i.test(k));
    return kws.slice(0, 10);
  }

  function generateCleanSummary(resume, jdKeywords) {
    const topSkills = extractResumeSkills(resume).slice(0,4);
    if (topSkills.length) {
      return `Aspiring candidate skilled in ${topSkills.join(', ')}. Quick learner with strong communication and adaptability, ready to contribute and grow in the role.`;
    }
    if (jdKeywords && jdKeywords.length) {
      return `Aspiring candidate with foundation in ${jdKeywords.slice(0,4).join(', ')}. Fast learner and motivated to adapt to company workflows.`;
    }
    return 'Aspiring candidate and quick learner, ready to contribute and grow in the role.';
  }

  function createPracticeProjects(roleKeywords) {
    const r = roleKeywords.join(' ');
    if (/sql|database|mysql|postgres|query|stored procedure/.test(r)) {
      return [
        {title: 'SQL Practice Project', bullets: [
          'Built sample databases and practiced SELECT, JOIN, GROUP BY queries on public datasets.',
          'Implemented CRUD operations and simple stored procedures to manipulate data.',
          'Optimized queries using proper indexes and analyzed performance.'
        ]}
      ];
    }
    if (/ui|ux|figma|design|prototype|wireframe/.test(r)) {
      return [
        {title: 'UI/UX Practice Project', bullets: [
          'Designed 2–3 app screens using Figma and created a clickable prototype.',
          'Applied basic UX principles: user flow, visual hierarchy, and accessibility.',
          'Recreated an existing app screen to improve usability.'
        ]}
      ];
    }
    if (/python|java|node|react|angular|vue|javascript|backend|frontend|web/.test(r)) {
      return [
        {title: 'Web Development Practice Project', bullets: [
          'Built a small web app using HTML/CSS/JavaScript (or React) to understand components.',
          'Implemented basic REST API calls using mock data.',
          'Deployed a simple static site and practiced debugging and console logs.'
        ]}
      ];
    }
    return [
      {title: 'Practice Project', bullets: [
        'Completed role-relevant exercises and small tasks to build practical familiarity.',
        'Documented learning and results in a short project summary to discuss in interviews.'
      ]}
    ];
  }

  // ----- actions -----
  function handleAnalyze() {
    const jdKeywords = extractKeywords(jobDescText,40);
    setKeywords(jdKeywords);
    setInitialScore(computeScore(resumeText, jdKeywords));
    const lev = analyzeIntensity(jobDescText);
    setIntensity(lev);

    const auto = extractCompanyName(jobDescText);
    setAutoCompany(auto);
    if (auto && !companyName) setCompanyName(auto);

    const notesArr = [];
    if (lev === 'high') notesArr.push('This job looks heavy on programming; recommended to skip unless you have 2–3+ yrs experience.');
    if (lev === 'moderate') notesArr.push('Moderate programming — possible with quick learning (see study plan).');
    if (lev === 'low') notesArr.push('Light programming or non-coding role; safe to apply as a fresher.');
    setNotes(notesArr);
  }

  function handleGenerate() {
    const jdKeywords = extractKeywords(jobDescText,40);
    setKeywords(jdKeywords);
    setInitialScore(computeScore(resumeText, jdKeywords));

    const sentences = splitSentences(resumeText);
    const matched = sentences.filter(s => jdKeywords.some(k => norm(s).includes(k)));

    if (matched.length > 0) {
      setMatchedSentences(matched.slice(0,12).map(s => s.length > 180 ? s.slice(0,177)+'...' : s));
    } else {
      const pract = createPracticeProjects(jdKeywords);
      const created = pract.flatMap(p => {
        return [p.title, ...p.bullets.map(b => (b.length>180? b.slice(0,177)+'...' : b))];
      });
      setMatchedSentences(created.slice(0,12));
    }

    const tailoredText = (matched.length ? matched.join(' ') : matchedSentences.join(' '));
    const newScore = computeScore(tailoredText || resumeText, jdKeywords);
    setPostScore(newScore);

    const lev = analyzeIntensity(jobDescText);
    setIntensity(lev);
    const notesArr = [];
    if (lev === 'high') notesArr.push('Red — heavy programming demand. The tool strongly suggests not applying.');
    if (lev === 'moderate') notesArr.push('Yellow — consider applying and prepare the short study plan.');
    if (lev === 'low') notesArr.push('Green — safe to apply.');
    const missing = keywords.filter(k => !norm(resumeText).includes(k)).slice(0,8);
    if (missing.length) notesArr.push('Missing / recommended keywords: ' + missing.join(', '));
    setNotes(notesArr);
  }

  async function handleDownloadPDF() {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const el = previewRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pageWidth - 40;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
      const safeCompany = (companyName || 'Company').replace(/[^A-Za-z0-9_-]/g, '_');
      const filename = `Prabhu_${safeCompany}_resume.pdf`;
      pdf.save(filename);
    } catch (e) {
      console.error(e);
      alert('PDF export failed — check console for details.');
    }
  }

  useEffect(()=>{
    if (jobDescText.trim()) handleAnalyze();
    else { setKeywords([]); setInitialScore(null); setPostScore(null); setIntensity(null); setAutoCompany(''); }
  }, [jobDescText]);

  function IntensityBadge({level}) {
    if (!level) return null;
    const s = level === 'high' ? {bg:'#fff1f2', color:'#9f1239', text:'RED — Heavy programming'} : level==='moderate' ? {bg:'#fffbeb', color:'#92400e', text:'YELLOW — Moderate'} : {bg:'#ecfdf5', color:'#065f46', text:'GREEN — Light'};
    return <div style={{background:s.bg, color:s.color, padding:'6px 10px', borderRadius:8, fontWeight:800}}>{s.text}</div>;
  }

  function getStudyPlan() {
    const t = keywords.join(' ');
    if (/sql|database|mysql|postgres|query|stored procedure/.test(t)) {
      return [
        'Learn SELECT, WHERE, ORDER BY',
        'Practice JOINs (INNER, LEFT) and GROUP BY',
        'Solve 10 SQL problems from online platforms',
        'Build a small sample DB and write CRUD queries'
      ];
    }
    if (/ui|ux|figma|prototype|wireframe/.test(t)) {
      return [
        'Watch a short Figma intro (30–60 min) and follow along',
        'Create 2 screens and make a clickable prototype',
        'Learn basic UX principles: user flow, hierarchy',
        'Practice by recreating a simple app screen'
      ];
    }
    if (/devops|docker|kubernetes|ci\/cd|automation|scripting/.test(t)) {
      return [
        'Learn Docker basics and run a container',
        'Understand CI/CD concepts and simple pipelines',
        'Practice basic shell scripting (bash)',
        'Deploy a simple app using a PaaS or static host'
      ];
    }
    return ['Review the missing keywords listed in suggestions', 'Prepare quick examples or small practice tasks to show in interviews'];
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 18 }}>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>JobFit ATS — Integrated (Template 1)</h1>
      <p style={{ color: '#374151' }}>Single-column ATS template + auto-filter for programming-heavy roles. Red listings are discouraged; yellow listings offer a study plan; green listings are safe.</p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 420px', gap: 12, marginTop: 12 }}>
        <div>
          <label style={{fontWeight:700}}>Master resume (paste/edit)</label>
          <textarea rows={8} value={resumeText} onChange={e=>setResumeText(e.target.value)} style={{ width:'100%', marginTop:8, padding:10 }} />

          <label style={{fontWeight:700, marginTop:10}}>Job description (paste)</label>
          <textarea rows={8} value={jobDescText} onChange={e=>setJobDescText(e.target.value)} style={{ width:'100%', marginTop:8, padding:10 }} placeholder='Paste full JD text here' />

          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button onClick={handleAnalyze} style={{ padding:'10px 14px', background:'#0f172a', color:'#fff', border:'none', borderRadius:8 }}>Analyze</button>
            <button onClick={handleGenerate} style={{ padding:'10px 14px', border:'1px solid #0f172a', borderRadius:8, background:'#fff' }}>Generate Tailored</button>
            <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
              <IntensityBadge level={intensity} />
            </div>
          </div>

          <div style={{ display:'flex', gap:8, marginTop:12, alignItems:'center' }}>
            <div style={{ padding:10, border:'1px solid #e6e6e6', borderRadius:8 }}>
              <div style={{fontSize:12, color:'#6b7280'}}>Initial score</div>
              <div style={{fontWeight:800}}>{initialScore===null? '—': initialScore+'%'}</div>
            </div>
            <div style={{ padding:10, border:'1px solid #e6e6e6', borderRadius:8 }}>
              <div style={{fontSize:12, color:'#6b7280'}}>Post score</div>
              <div style={{fontWeight:800}}>{postScore===null? '—': postScore+'%'}</div>
            </div>
            <div style={{ padding:10, border:'1px solid #e6e6e6', borderRadius:8, marginLeft:'auto' }}>
              <div style={{fontSize:12, color:'#6b7280'}}>Company</div>
              <input value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder={autoCompany || 'Company name (editable)'} style={{ padding:6, marginTop:6 }} />
            </div>
          </div>

          <div style={{ marginTop:12 }}>
            <div style={{ fontWeight:700 }}>Notes</div>
            <ul>
              {notes.length===0 ? <li style={{color:'#6b7280'}}>No notes — click Analyze or Generate.</li> : notes.map((n,i)=>(<li key={i}>{n}</li>))}
            </ul>
          </div>
        </div>

        <div>
          <div style={{ padding:12, border:'1px solid #e6e6e6', borderRadius:8 }}>
            <div style={{ fontWeight:800, marginBottom:8 }}>Tailored resume preview (Template 1)</div>
            <div ref={previewRef} style={{ background:'#fff', padding:18, borderRadius:6 }}>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:900 }}>Prabhu</div>
                  <div style={{ fontSize:12, color:'#374151', marginTop:4 }}>{companyName ? `${companyName} — Tailored Resume` : 'Tailored Resume'}</div>
                </div>
                <div style={{ textAlign:'right', fontSize:12, color:'#374151' }}></div>
              </div>

              <div style={{ marginTop:12 }}>
                <div style={{ fontWeight:800, fontSize:12 }}>SUMMARY</div>
                <div style={{ marginTop:6, fontSize:13, lineHeight:1.4 }}>{generateCleanSummary(resumeText, keywords)}</div>
              </div>

              <div style={{ marginTop:10 }}>
                <div style={{ fontWeight:800, fontSize:12 }}>SKILLS</div>
                <div style={{ marginTop:6, fontSize:13 }}>{extractResumeSkills(resumeText).slice(0,10).join(' • ')}</div>
              </div>

              <div style={{ marginTop:10 }}>
                <div style={{ fontWeight:800, fontSize:12 }}>PROJECTS / EXPERIENCE</div>
                <ul style={{ marginTop:8, paddingLeft:18 }}>
                  {matchedSentences.length === 0 ? (
                    <li style={{ color:'#6b7280' }}>No matched bullets. Generated practice projects will appear after Generate.</li>
                  ) : matchedSentences.map((s,i) => (<li key={i} style={{ marginBottom:6, fontSize:13, lineHeight:1.35 }}>{s}</li>))}
                </ul>
              </div>

              <div style={{ marginTop:12 }}>
                <div style={{ fontWeight:800, fontSize:12 }}>EDUCATION</div>
                <div style={{ marginTop:6, fontSize:13 }}>B.Tech — Your College — Year</div>
              </div>

            </div>

            <div style={{ marginTop:10, display:'flex', gap:8 }}>
              <button onClick={handleDownloadPDF} disabled={intensity==='high'} style={{ padding:'10px 14px', background: intensity==='high' ? '#fca5a5' : '#0f172a', color:'#fff', border:'none', borderRadius:8, cursor: intensity==='high' ? 'not-allowed' : 'pointer' }}>{intensity==='high' ? 'Apply disabled (Heavy)' : 'Download PDF'}</button>
              <button onClick={()=>navigator.clipboard?.writeText(matchedSentences.join('\n\n'))} style={{ padding:'10px 14px', border:'1px solid #0f172a', borderRadius:8 }}>Copy text</button>
              <button onClick={()=>{ if(intensity==='moderate') setShowPlan(true); else alert('Study plan available only for moderate roles.'); }} style={{ padding:'10px 14px', borderRadius:8 }}>{intensity==='moderate' ? 'Open study plan' : 'Study plan'}</button>
            </div>

            <div style={{ marginTop:12 }}>
              <div style={{ fontWeight:700 }}>Suggestions</div>
              <div style={{ color:'#374151', marginTop:6 }}>{notes.length? notes.join(' • ') : 'No suggestions yet.'}</div>
            </div>
          </div>
        </div>
      </div>

      {showPlan && (
        <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.35)' }}>
          <div style={{ width:520, background:'#fff', padding:18, borderRadius:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:800 }}>Short study plan</div>
              <button onClick={()=>setShowPlan(false)} style={{ border:'none', background:'transparent', fontSize:18, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ marginTop:10 }}>
              <div style={{ marginBottom:8 }}>Suggested focused topics to prepare quickly:</div>
              <ul>
                {getStudyPlan().map((p,i)=>(<li key={i} style={{ marginBottom:6 }}>{p}</li>))}
              </ul>
              <div style={{ marginTop:8, color:'#374151' }}>Tip: spend 1–2 days on each bullet, create a small output (repo, prototype, SQL file) to show during interviews.</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop:12, color:'#6b7280', fontSize:13 }}>Note: For "heavy" roles the app will disable downloads/apply to avoid wasting time. You can still edit the JD or force-generate if you want to practice.</div>

    </div>
  );
}
