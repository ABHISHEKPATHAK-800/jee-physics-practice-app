// Simple draggable scientific-ish calculator, modeled loosely on the
// on-screen calculator NTA provides during the real JEE Main exam.
(function(){
  const KEYS = [
    'C','(',')','÷',
    '7','8','9','×',
    '4','5','6','−',
    '1','2','3','+',
    '0','.','^','=',
    '√','sin','cos','tan'
  ];

  function init(){
    const grid = document.getElementById('calc-grid');
    const display = document.getElementById('calc-display');
    if (!grid) return;
    let expr = '';

    KEYS.forEach(k=>{
      const b = document.createElement('button');
      b.textContent = k;
      if ('÷×−+'.includes(k)) b.classList.add('op');
      if (k === '=') b.classList.add('eq');
      b.addEventListener('click', ()=>{
        if (k === 'C'){ expr=''; }
        else if (k === '='){
          try{
            let safe = expr
              .replace(/÷/g,'/').replace(/×/g,'*').replace(/−/g,'-')
              .replace(/\^/g,'**')
              .replace(/√\(?(-?\d+(\.\d+)?)\)?/g, (_,n)=>`Math.sqrt(${n})`)
              .replace(/sin\(?(-?\d+(\.\d+)?)\)?/g, (_,n)=>`Math.sin((${n})*Math.PI/180)`)
              .replace(/cos\(?(-?\d+(\.\d+)?)\)?/g, (_,n)=>`Math.cos((${n})*Math.PI/180)`)
              .replace(/tan\(?(-?\d+(\.\d+)?)\)?/g, (_,n)=>`Math.tan((${n})*Math.PI/180)`);
            // eslint-disable-next-line no-eval
            const result = Function(`"use strict"; return (${safe})`)();
            expr = String(Math.round(result*1e8)/1e8);
          }catch(e){ expr = 'Error'; }
        } else if (['sin','cos','tan','√'].includes(k)){
          expr += k+'(';
        } else {
          expr += k;
        }
        display.value = expr || '0';
      });
      grid.appendChild(b);
    });

    // dragging
    const win = document.getElementById('calc-window');
    const bar = document.getElementById('calc-titlebar');
    let dragging=false, ox=0, oy=0;
    bar.addEventListener('mousedown', e=>{
      dragging=true; ox = e.clientX - win.offsetLeft; oy = e.clientY - win.offsetTop;
    });
    document.addEventListener('mousemove', e=>{
      if(!dragging) return;
      win.style.left = (e.clientX-ox)+'px';
      win.style.top = (e.clientY-oy)+'px';
      win.style.right = 'auto';
    });
    document.addEventListener('mouseup', ()=> dragging=false);

    document.getElementById('btn-calc').addEventListener('click', ()=>{
      win.classList.toggle('active');
    });
    document.getElementById('calc-close').addEventListener('click', ()=> win.classList.remove('active'));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
