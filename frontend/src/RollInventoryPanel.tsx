import {useState} from 'react';
import {Box,Button,Chip,FormControl,InputLabel,MenuItem,Paper,Select,Stack,Tab,Tabs,TextField,Typography} from '@mui/material';

type RollRow={agency:string;zone:'Capital'|'Interior';tjCoupons:number;tjRolls:number;lahuanCoupons:number;lahuanRolls:number};
type RollZone='Todas'|'Capital'|'Interior';
type RollInventory={date:string;stockSunmi:number;stockLahuan:number;baseline:Record<string,{sunmiCoupons:number;lahuanCoupons:number}>};
type RollConsumption={sunmi:number;lahuan:number};
type Props={rolls:RollRow[];zone:RollZone;setZone:(zone:RollZone)=>void;selectedAgencies:string[];toggleAgency:(agency:string)=>void;toggleAllAgencies:()=>void;deliveredRolls:Record<string,number>;updateDelivered:(agency:string,value:string)=>void;onImport:(file:File)=>void;onExport:(format:string,rows:RollRow[],consumption:Record<string,RollConsumption>)=>void};

function today(){return new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)}

function loadInventory():RollInventory|null{const saved=localStorage.getItem('roll-inventory');return saved?JSON.parse(saved) as RollInventory:null}

export default function RollInventoryPanel({rolls,zone,setZone,selectedAgencies,toggleAgency,toggleAllAgencies,deliveredRolls,updateDelivered,onImport,onExport}:Props){
  const [section,setSection]=useState<'stock'|'deliveries'>('stock');
  const [inventory,setInventory]=useState<RollInventory|null>(loadInventory);
  const [inventoryDate,setInventoryDate]=useState(()=>inventory?.date||today());
  const [loadedRankDate,setLoadedRankDate]=useState(()=>localStorage.getItem('coupon-roll-date')||'');
  const [rankingDate,setRankingDate]=useState(()=>loadedRankDate||today());
  const [stockSunmi,setStockSunmi]=useState(()=>String(inventory?.stockSunmi??0));
  const [stockLahuan,setStockLahuan]=useState(()=>String(inventory?.stockLahuan??0));
  const filteredRolls=rolls.filter(row=>zone==='Todas'||row.zone===zone);
  const consumption=(row:RollRow,type:'sunmi'|'lahuan')=>{
    if(!inventory)return 0;
    const baseline=inventory.baseline[row.agency];
    const current=type==='sunmi'?row.tjCoupons:row.lahuanCoupons;
    const initial=type==='sunmi'?baseline?.sunmiCoupons:baseline?.lahuanCoupons;
    return Math.max(0,current-(initial??0))/(type==='sunmi'?130:286);
  };
  const totalSunmi=rolls.reduce((sum,row)=>sum+consumption(row,'sunmi'),0);
  const totalLahuan=rolls.reduce((sum,row)=>sum+consumption(row,'lahuan'),0);
  const exportSelected=(format:string)=>{
    const selected=filteredRolls.filter(row=>selectedAgencies.includes(row.agency));
    const values=Object.fromEntries(selected.map(row=>[row.agency,{sunmi:consumption(row,'sunmi'),lahuan:consumption(row,'lahuan')}]));
    onExport(format,selected,values);
  };
  const saveInventory=()=>{
    if(!rolls.length||!inventoryDate||loadedRankDate!==inventoryDate)return;
    const next:RollInventory={date:inventoryDate,stockSunmi:Math.max(0,Number(stockSunmi)||0),stockLahuan:Math.max(0,Number(stockLahuan)||0),baseline:Object.fromEntries(rolls.map(row=>[row.agency,{sunmiCoupons:row.tjCoupons,lahuanCoupons:row.lahuanCoupons}]))};
    setInventory(next);
    localStorage.setItem('roll-inventory',JSON.stringify(next));
  };
  const importRanking=(file:File,date:string)=>{
    const previousDate=localStorage.getItem('coupon-roll-date')||'';
    if((inventory&&date<inventory.date)||(previousDate&&date<previousDate)){
      window.alert('La fecha del ranking no puede ser anterior al stock registrado ni a la última carga.');
      return;
    }
    onImport(file);
    localStorage.setItem('coupon-roll-date',date);
    setLoadedRankDate(date);
  };

  return <Paper className="gantt"><Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}><Box><Typography variant="h6">Gestión de rollos</Typography></Box></Stack>
    <Tabs value={section} onChange={(_,value)=>setSection(value)} sx={{borderBottom:1,borderColor:'divider',mb:2}}><Tab value="stock" label="Stock y consumo"/><Tab value="deliveries" label="Entregas a agencias"/></Tabs>
    {section==='stock'&&<>
    <Typography color="text.secondary">Cargá el ranking de Boca del día en que recibís el stock; después, importá rankings con fecha posterior.</Typography>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{my:2}}>
      <TextField size="small" type="date" label="Fecha del inventario" InputLabelProps={{shrink:true}} value={inventoryDate} onChange={event=>setInventoryDate(event.target.value)}/>
      <TextField size="small" type="number" label="Stock Sunmi" inputProps={{min:0,step:.1}} value={stockSunmi} onChange={event=>setStockSunmi(event.target.value)}/>
      <TextField size="small" type="number" label="Stock Lahuan" inputProps={{min:0,step:.1}} value={stockLahuan} onChange={event=>setStockLahuan(event.target.value)}/>
      <Button variant="outlined" onClick={saveInventory} disabled={!rolls.length||!inventoryDate||loadedRankDate!==inventoryDate}>Registrar stock y corte</Button>
    </Stack>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mb:2}} alignItems="center"><TextField size="small" type="date" label="Fecha del ranking Boca" InputLabelProps={{shrink:true}} value={rankingDate} onChange={event=>setRankingDate(event.target.value)}/><Button component="label" variant="contained" disabled={!rankingDate}>Importar ranking de Boca<input hidden type="file" accept=".xlsx,.xls" onChange={event=>{const file=event.target.files?.[0];if(file)importRanking(file,rankingDate);event.target.value=''}}/></Button><Typography variant="body2" color="text.secondary">{loadedRankDate?`Ranking cargado: ${loadedRankDate}`:'Todavía no hay un ranking fechado.'}</Typography></Stack>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mb:2}}>
      <Chip label={`Agencias: ${filteredRolls.length}`}/>
      {inventory?<><Chip color="primary" label={`Consumo Sunmi: ${totalSunmi.toFixed(1)} · Stock restante: ${(inventory.stockSunmi-totalSunmi).toFixed(1)}`}/><Chip color="secondary" label={`Consumo Lahuan: ${totalLahuan.toFixed(1)} · Stock restante: ${(inventory.stockLahuan-totalLahuan).toFixed(1)}`}/><Chip variant="outlined" label={`Corte: ${inventory.date}`}/></>:<Chip variant="outlined" label="Sin corte de inventario"/>}
    </Stack>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mb:2}}>
      <Button size="small" onClick={toggleAllAgencies}>{selectedAgencies.length===filteredRolls.length?'Desmarcar todas':'Marcar todas'}</Button>
      <Button size="small" onClick={()=>exportSelected('xlsx')} disabled={!selectedAgencies.length}>Excel seleccionadas</Button>
      <Button size="small" onClick={()=>exportSelected('pdf')} disabled={!selectedAgencies.length}>PDF seleccionadas</Button>
      <FormControl size="small" sx={{minWidth:140}}><InputLabel>Zona</InputLabel><Select label="Zona" value={zone} onChange={event=>setZone(event.target.value as RollZone)}><MenuItem value="Todas">Todas</MenuItem><MenuItem value="Capital">Capital</MenuItem><MenuItem value="Interior">Interior</MenuItem></Select></FormControl>
    </Stack>
    <Box sx={{overflowX:'auto'}}><table className="report-table"><thead><tr><th><input type="checkbox" checked={filteredRolls.length>0&&selectedAgencies.length===filteredRolls.length} onChange={toggleAllAgencies}/></th><th>Zona</th><th>Agencia</th><th>Consumo Sunmi desde corte</th><th>Consumo Lahuan desde corte</th><th>Cupones Sunmi</th><th>Rollos Sunmi acumulados</th><th>Cupones Lahuan</th><th>Rollos Lahuan acumulados</th></tr></thead><tbody>{filteredRolls.map(row=><tr key={row.agency}><td><input type="checkbox" checked={selectedAgencies.includes(row.agency)} onChange={()=>toggleAgency(row.agency)}/></td><td>{row.zone}</td><td>{row.agency}</td><td>{inventory?consumption(row,'sunmi').toFixed(1):'-'}</td><td>{inventory?consumption(row,'lahuan').toFixed(1):'-'}</td><td>{row.tjCoupons}</td><td>{row.tjRolls.toFixed(1)}</td><td>{row.lahuanCoupons}</td><td>{row.lahuanRolls.toFixed(1)}</td></tr>)}</tbody></table>
      {!rolls.length&&<Typography color="text.secondary" sx={{p:2}}>Importá el ranking correspondiente al día del inventario para fijar el corte.</Typography>}
    </Box>
    </>}
    {section==='deliveries'&&<>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mb:2}}>
        <Chip label={`Agencias: ${filteredRolls.length}`}/>
        <Chip color="primary" label={`Rollos entregados: ${filteredRolls.reduce((sum,row)=>sum+(deliveredRolls[row.agency]||0),0).toFixed(1)}`}/>
        <FormControl size="small" sx={{minWidth:140}}><InputLabel>Zona</InputLabel><Select label="Zona" value={zone} onChange={event=>setZone(event.target.value as RollZone)}><MenuItem value="Todas">Todas</MenuItem><MenuItem value="Capital">Capital</MenuItem><MenuItem value="Interior">Interior</MenuItem></Select></FormControl>
      </Stack>
      <Box sx={{overflowX:'auto'}}><table className="report-table"><thead><tr><th>Zona</th><th>Agencia</th><th>Rollos Sunmi acumulados</th><th>Rollos entregados</th><th>Saldo</th></tr></thead><tbody>{filteredRolls.map(row=>{const delivered=deliveredRolls[row.agency]||0;const balance=row.tjRolls-delivered;return <tr key={row.agency}><td>{row.zone}</td><td>{row.agency}</td><td>{row.tjRolls.toFixed(1)}</td><td><TextField size="small" type="number" inputProps={{min:0,step:.1}} value={delivered||''} onChange={event=>updateDelivered(row.agency,event.target.value)}/></td><td style={{color:balance<0?'#d32f2f':undefined,fontWeight:balance<0?700:undefined}}>{balance.toFixed(1)}</td></tr>})}</tbody></table>
        {!rolls.length&&<Typography color="text.secondary" sx={{p:2}}>Importá un ranking para ver las agencias y registrar sus entregas.</Typography>}
      </Box>
    </>}
  </Paper>;
}