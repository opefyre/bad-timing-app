export function parseCsv(input: string): Record<string,string>[] {
  if(input.length>5_000_000) throw new Error('CSV too large');
  const rows:string[][]=[]; let row:string[]=[];let cell='';let quoted=false;
  for(let i=0;i<input.length;i++) {
    const c=input[i];
    if(c==='"') { if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted; }
    else if(!quoted&&(c===','||c==='\n'||c==='\r')) { row.push(cell);cell='';if(c!==','){if(c==='\r'&&input[i+1]==='\n')i++;if(row.some(Boolean))rows.push(row);row=[];} }
    else cell+=c;
    if(rows.length>25000||cell.length>100000)throw new Error('CSV limits exceeded');
  }
  if(quoted)throw new Error('Unclosed CSV string');
  if(cell||row.length){row.push(cell);rows.push(row);}
  const headers=rows.shift()?.map(h=>h.replace(/^\uFEFF/,'').trim()); if(!headers?.length)throw new Error('CSV headers missing');
  return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
