import {useState} from 'react';
import {Box,Button,Chip,FormControl,InputLabel,MenuItem,Paper,Select,Stack,TextField,Typography} from '@mui/material';

type RollRow={agency:string;zone:'Capital'|'Interior';tjCoupons:number;tjRolls:number;lahuanCoupons:number;lahuanRolls:number};
type RollZone='Todas'|'Capital'|'Interior';
type RollInventory={date:string;stockSunmi:number;stockLahuan:number;baseline:Record<string,{sunmiCoupons:number;lahuanCoupons:number}>};
type RollConsumption={sunmi:number;lahuan:number};
type Props={section:'stock'|'deliveries';rolls:RollRow[];zone:RollZone;setZone:(zone:RollZone)=>void;selectedAgencies:string[];toggleAgency:(agency:string)=>void;toggleAllAgencies:()=>void;deliveredRolls:Record<string,number>;updateDelivered:(agency:string,value:string)=>void;onImport:(file:File)=>Promise<RollRow[]>;onImportMonthly:(file:File)=>Promise<RollRow[]>;onExport:(format:string,rows:RollRow[],consumption:Record<string,RollConsumption>)=>void};

function today(){return new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)}

function parseRollAmount(value:string):number{
  const text=value.trim().replace(/\s/g,'');
  if(!text)return 0;
  const comma=text.lastIndexOf(',');
  const dot=text.lastIndexOf('.');
  const normalized=comma>=0&&dot>=0?(comma>dot?text.replace(/\./g,'').replace(',','.'):text.replace(/,/g,'')):text.replace(',','.');
  const parsed=Number(normalized);
  return Number.isFinite(parsed)?parsed:0;
}

const rollFormatter=new Intl.NumberFormat('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1});
const couponFormatter=new Intl.NumberFormat('es-AR',{maximumFractionDigits:0});

function loadInventory():RollInventory|null{const saved=localStorage.getItem('roll-inventory');return saved?JSON.parse(saved) as RollInventory:null}
function loadMonthlyRolls():RollRow[]{const saved=localStorage.getItem('monthly-coupon-roll-data');return saved?JSON.parse(saved) as RollRow[]:[]}

export default function RollInventoryPanel({section,rolls,zone,setZone,selectedAgencies,toggleAgency,toggleAllAgencies,deliveredRolls,updateDelivered,onImport,onImportMonthly,onExport}:Props){
  const [deliveryInputs,setDeliveryInputs]=useState<Record<string,string>>({});
  const [inventory,setInventory]=useState<RollInventory|null>(loadInventory);
  const [monthlyRolls,setMonthlyRolls]=useState<RollRow[]>(loadMonthlyRolls);
  const [inventoryDate,setInventoryDate]=useState(()=>inventory?.date||today());
  const [loadedRankDate,setLoadedRankDate]=useState(()=>localStorage.getItem('coupon-roll-date')||'');
  const [rankingDate,setRankingDate]=useState(()=>loadedRankDate||today());
  const [monthlyPeriod,setMonthlyPeriod]=useState(()=>localStorage.getItem('monthly-coupon-roll-period')||today().slice(0,7));
  const [stockSunmi,setStockSunmi]=useState(()=>String(inventory?.stockSunmi??0));
  const [stockLahuan,setStockLahuan]=useState(()=>String(inventory?.stockLahuan??0));
  const filteredRolls=rolls.filter(row=>zone==='Todas'||row.zone===zone);
  const filteredMonthlyRolls=monthlyRolls.filter(row=>zone==='Todas'||row.zone===zone);
  const inventoryReady=!!inventory&&Object.keys(inventory.baseline).length>0;
  const consumption=(row:RollRow,type:'sunmi'|'lahuan')=>{
    if(!inventory)return 0;
    const baseline=inventory.baseline[row.agency];
    if(!baseline)return 0;
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
    if(!inventoryDate)return;
    if(loadedRankDate>inventoryDate){window.alert('La fecha del stock no puede ser anterior al último ranking cargado.');return}
    const baseline=loadedRankDate===inventoryDate?Object.fromEntries(rolls.map(row=>[row.agency,{sunmiCoupons:row.tjCoupons,lahuanCoupons:row.lahuanCoupons}])):{};
    const next:RollInventory={date:inventoryDate,stockSunmi:Math.max(0,parseRollAmount(stockSunmi)),stockLahuan:Math.max(0,parseRollAmount(stockLahuan)),baseline};
    setInventory(next);
    localStorage.setItem('roll-inventory',JSON.stringify(next));
  };
  const importRanking=async(file:File,date:string)=>{
    const previousDate=localStorage.getItem('coupon-roll-date')||'';
    if((inventory&&date<inventory.date)||(previousDate&&date<previousDate)){
      window.alert('La fecha del ranking no puede ser anterior al stock registrado ni a la última carga.');
      return;
    }
    if(inventory&&!inventoryReady&&date!==inventory.date){window.alert(`Primero importá el ranking del día del stock: ${inventory.date}.`);return}
    if(!inventory)setInventoryDate(date);
    const imported=await onImport(file);
    if(inventory&&date===inventory.date&&!inventoryReady){
      const next:RollInventory={...inventory,baseline:Object.fromEntries(imported.map(row=>[row.agency,{sunmiCoupons:row.tjCoupons,lahuanCoupons:row.lahuanCoupons}]))};
      setInventory(next);
      localStorage.setItem('roll-inventory',JSON.stringify(next));
    }
    localStorage.setItem('coupon-roll-date',date);
    setLoadedRankDate(date);
  };
  const importMonthlyRanking=async(file:File)=>{
    const imported=await onImportMonthly(file);
    setMonthlyRolls(imported);
    localStorage.setItem('monthly-coupon-roll-data',JSON.stringify(imported));
    localStorage.setItem('monthly-coupon-roll-period',monthlyPeriod);
  };
  const commitDelivery=(agency:string,fallback:number)=>{
    const value=deliveryInputs[agency]??String(fallback);
    updateDelivered(agency,String(Math.max(0,parseRollAmount(value))));
    setDeliveryInputs(current=>{const updated={...current};delete updated[agency];return updated});
  };

  return <Paper className="gantt"><Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}><Box><Typography variant="h6">{section==='deliveries'?'Cantidad de rollos':'Consumo de rollos'}</Typography></Box></Stack>
    {section==='stock'&&<>
    <Typography color="text.secondary">Cargá el ranking de Boca del día en que recibís el stock; después, importá rankings con fecha posterior.</Typography>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{my:2}}>
      <TextField size="small" type="date" label="Fecha del inventario" InputLabelProps={{shrink:true}} value={inventoryDate} onChange={event=>setInventoryDate(event.target.value)}/>
      <TextField size="small" label="Stock Sunmi" inputProps={{inputMode:'decimal'}} value={stockSunmi} onChange={event=>setStockSunmi(event.target.value)}/>
      <TextField size="small" label="Stock Lahuan" inputProps={{inputMode:'decimal'}} value={stockLahuan} onChange={event=>setStockLahuan(event.target.value)}/>
      <Button variant="outlined" onClick={saveInventory} disabled={!inventoryDate}>Registrar stock y corte</Button>
    </Stack>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mb:2}} alignItems="center"><TextField size="small" type="date" label="Fecha del ranking Boca" InputLabelProps={{shrink:true}} value={rankingDate} onChange={event=>setRankingDate(event.target.value)}/><Button component="label" variant="contained" disabled={!rankingDate}>Importar ranking de Boca<input hidden type="file" accept=".xlsx,.xls" onChange={event=>{const file=event.target.files?.[0];if(file)importRanking(file,rankingDate);event.target.value=''}}/></Button><Typography variant="body2" color="text.secondary">{loadedRankDate?`Ranking cargado: ${loadedRankDate}`:'Todavía no hay un ranking fechado.'}{loadedRankDate&&loadedRankDate!==inventoryDate?' · Para registrar el corte, igualá la fecha del inventario con la del ranking.':''}</Typography></Stack>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mb:2}}>
      <Chip label={`Agencias: ${filteredRolls.length}`}/>
      {inventoryReady?<><Chip color="primary" label={`Consumo Sunmi: ${rollFormatter.format(totalSunmi)} de ${rollFormatter.format(inventory!.stockSunmi)} rollos · Restante: ${rollFormatter.format(inventory!.stockSunmi-totalSunmi)}`}/><Chip color="secondary" label={`Consumo Lahuan: ${rollFormatter.format(totalLahuan)} de ${rollFormatter.format(inventory!.stockLahuan)} rollos · Restante: ${rollFormatter.format(inventory!.stockLahuan-totalLahuan)}`}/><Chip variant="outlined" label={`Corte: ${inventory!.date}`}/></>:inventory?<><Chip variant="outlined" label={`Stock registrado: ${inventory.date}`}/><Chip color="warning" label="Falta importar el ranking del día del stock"/></>:<Chip variant="outlined" label="Sin corte de inventario"/>}
    </Stack>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mb:2}}>
      <Button size="small" onClick={toggleAllAgencies}>{selectedAgencies.length===filteredRolls.length?'Desmarcar todas':'Marcar todas'}</Button>
      <Button size="small" onClick={()=>exportSelected('xlsx')} disabled={!selectedAgencies.length}>Excel seleccionadas</Button>
      <Button size="small" onClick={()=>exportSelected('pdf')} disabled={!selectedAgencies.length}>PDF seleccionadas</Button>
      <FormControl size="small" sx={{minWidth:140}}><InputLabel>Zona</InputLabel><Select label="Zona" value={zone} onChange={event=>setZone(event.target.value as RollZone)}><MenuItem value="Todas">Todas</MenuItem><MenuItem value="Capital">Capital</MenuItem><MenuItem value="Interior">Interior</MenuItem></Select></FormControl>
    </Stack>
    <Box sx={{overflowX:'auto'}}><table className="report-table"><thead><tr><th><input type="checkbox" checked={filteredRolls.length>0&&selectedAgencies.length===filteredRolls.length} onChange={toggleAllAgencies}/></th><th>Zona</th><th>Agencia</th><th>Consumo Sunmi desde corte</th><th>Consumo Lahuan desde corte</th><th>Cupones Sunmi</th><th>Rollos Sunmi acumulados</th><th>Cupones Lahuan</th><th>Rollos Lahuan acumulados</th></tr></thead><tbody>{filteredRolls.map(row=><tr key={row.agency}><td><input type="checkbox" checked={selectedAgencies.includes(row.agency)} onChange={()=>toggleAgency(row.agency)}/></td><td>{row.zone}</td><td>{row.agency}</td><td>{inventoryReady?rollFormatter.format(consumption(row,'sunmi')):'-'}</td><td>{inventoryReady?rollFormatter.format(consumption(row,'lahuan')):'-'}</td><td>{couponFormatter.format(row.tjCoupons)}</td><td>{rollFormatter.format(row.tjRolls)}</td><td>{couponFormatter.format(row.lahuanCoupons)}</td><td>{rollFormatter.format(row.lahuanRolls)}</td></tr>)}</tbody></table>
      {!rolls.length&&<Typography color="text.secondary" sx={{p:2}}>Importá el ranking correspondiente al día del inventario para fijar el corte.</Typography>}
    </Box>
    </>}
    {section==='deliveries'&&<>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mb:2}} alignItems="center"><TextField size="small" type="month" label="Período del ranking mensual" InputLabelProps={{shrink:true}} value={monthlyPeriod} onChange={event=>setMonthlyPeriod(event.target.value)}/><Button component="label" variant="contained" disabled={!monthlyPeriod}>Cargar ranking mensual<input hidden type="file" accept=".xlsx,.xls" onChange={event=>{const file=event.target.files?.[0];if(file)void importMonthlyRanking(file);event.target.value=''}}/></Button><Typography variant="body2" color="text.secondary">{localStorage.getItem('monthly-coupon-roll-period')?`Ranking mensual: ${localStorage.getItem('monthly-coupon-roll-period')}`:'Carga independiente del ranking de consumo, cada 30 días.'}</Typography></Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mb:2}}>
        <Chip label={`Agencias: ${filteredMonthlyRolls.length}`}/>
        <Chip color="primary" label={`Rollos entregados: ${rollFormatter.format(filteredMonthlyRolls.reduce((sum,row)=>sum+(deliveredRolls[row.agency]||0),0))}`}/>
        <FormControl size="small" sx={{minWidth:140}}><InputLabel>Zona</InputLabel><Select label="Zona" value={zone} onChange={event=>setZone(event.target.value as RollZone)}><MenuItem value="Todas">Todas</MenuItem><MenuItem value="Capital">Capital</MenuItem><MenuItem value="Interior">Interior</MenuItem></Select></FormControl>
      </Stack>
      <Box sx={{overflowX:'auto'}}><table className="report-table"><thead><tr><th>Zona</th><th>Agencia</th><th>Rollos Sunmi acumulados</th><th>Rollos entregados</th><th>Saldo</th></tr></thead><tbody>{filteredMonthlyRolls.map(row=>{const delivered=deliveredRolls[row.agency]||0;const balance=row.tjRolls-delivered;return <tr key={row.agency}><td>{row.zone}</td><td>{row.agency}</td><td>{rollFormatter.format(row.tjRolls)}</td><td><TextField size="small" inputProps={{inputMode:'decimal'}} value={deliveryInputs[row.agency]??(delivered?rollFormatter.format(delivered):'')} onChange={event=>setDeliveryInputs(current=>({...current,[row.agency]:event.target.value}))} onBlur={()=>commitDelivery(row.agency,delivered)}/></td><td style={{color:balance<0?'#d32f2f':undefined,fontWeight:balance<0?700:undefined}}>{rollFormatter.format(balance)}</td></tr>})}</tbody></table>
        {!monthlyRolls.length&&<Typography color="text.secondary" sx={{p:2}}>Cargá el ranking mensual para registrar entregas a las agencias.</Typography>}
      </Box>
    </>}
  </Paper>;
}