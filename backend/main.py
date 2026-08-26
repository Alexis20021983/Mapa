from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, String, Float, Integer, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session
from pydantic import BaseModel
from typing import Optional
import csv, io, json, os
from openpyxl import load_workbook

engine=create_engine("sqlite:///./mapa.db",connect_args={"check_same_thread":False})
class Base(DeclarativeBase): pass
class Marker(Base):
    __tablename__="markers"
    id:Mapped[int]=mapped_column(Integer,primary_key=True,autoincrement=True)
    name:Mapped[str]=mapped_column(String(160)); type:Mapped[str]=mapped_column(String(40))
    department:Mapped[str]=mapped_column(String(100)); locality:Mapped[str]=mapped_column(String(100))
    lat:Mapped[float]=mapped_column(Float); lng:Mapped[float]=mapped_column(Float); notes:Mapped[str]=mapped_column(String(1000),default="")
Base.metadata.create_all(engine)
class MarkerIn(BaseModel):
    name:str; type:str; department:str; locality:str; lat:float; lng:float; notes:str=""
class MarkerOut(MarkerIn): id:int; model_config={"from_attributes":True}
app=FastAPI(title="Mapa La Pampa API",version="1.0.0")
allowed_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS","http://localhost:5173").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware,allow_origins=allowed_origins,allow_methods=["*"],allow_headers=["*"])
@app.get("/")
def root():
    return {"name":"Mapa La Pampa API","docs":"/docs","markers":"/api/markers"}

@app.get("/health")
def health():
    return {"status":"ok"}

@app.get("/api")
def api_root():
    return {"status":"ok","markers":"/api/markers","docs":"/docs"}

def db(): 
    with Session(engine) as s: yield s
@app.get("/api/markers",response_model=list[MarkerOut])
@app.get("/markers",response_model=list[MarkerOut])
@app.get("/marcadores",response_model=list[MarkerOut])
def list_markers(department:Optional[str]=None,type:Optional[str]=None,s:Session=Depends(db)):
    q=select(Marker)
    if department:q=q.where(Marker.department==department)
    if type:q=q.where(Marker.type==type)
    return s.scalars(q).all()
@app.post("/api/markers",response_model=MarkerOut,status_code=201)
@app.post("/markers",response_model=MarkerOut,status_code=201)
@app.post("/marcadores",response_model=MarkerOut,status_code=201)
def create_marker(m:MarkerIn,s:Session=Depends(db)):
    x=Marker(**m.model_dump());s.add(x);s.commit();s.refresh(x);return x
@app.put("/api/markers/{id}",response_model=MarkerOut)
@app.put("/markers/{id}",response_model=MarkerOut)
@app.put("/marcadores/{id}",response_model=MarkerOut)
def update_marker(id:int,m:MarkerIn,s:Session=Depends(db)):
    x=s.get(Marker,id)
    if not x: raise HTTPException(404,"Marcador no encontrado")
    for k,v in m.model_dump().items(): setattr(x,k,v)
    s.commit();s.refresh(x);return x
@app.delete("/api/markers/{id}",status_code=204)
@app.delete("/markers/{id}",status_code=204)
@app.delete("/marcadores/{id}",status_code=204)
def delete_marker(id:int,s:Session=Depends(db)):
    x=s.get(Marker,id)
    if x:s.delete(x);s.commit()
@app.post("/api/markers/import")
@app.post("/importar-excel")
async def import_markers(file:UploadFile=File(...),s:Session=Depends(db)):
    data=await file.read(); rows=[]
    if file.filename and file.filename.lower().endswith(".json"): rows=json.loads(data)
    elif file.filename and file.filename.lower().endswith((".xlsx",".xls")):
        sheet=load_workbook(io.BytesIO(data),read_only=True,data_only=True).active
        values=list(sheet.values); headers=[str(h).strip() for h in values[0]]
        rows=[dict(zip(headers,row)) for row in values[1:] if any(row)]
    else: rows=list(csv.DictReader(io.StringIO(data.decode("utf-8-sig"))))
    aliases={"Nombre":"name","Localidad":"locality","Agencia":"department","Codigo":"code","Estado":"status","X":"lng","Y":"lat","Observaciones":"notes"}
    for row in rows:
        normalized={aliases.get(str(k).strip(),str(k).strip().lower()):v for k,v in row.items()}
        x=Marker(name=str(normalized.get("name","Sin nombre")),type=str(normalized.get("type") or "Agencia Oficial"),department=str(normalized.get("department") or "Sin asignar"),locality=str(normalized.get("locality","Sin localidad")),lat=float(normalized.get("lat",50)),lng=float(normalized.get("lng",50)),notes=str(normalized.get("notes") or normalized.get("agencia") or normalized.get("status") or normalized.get("code") or ""));s.add(x)
    s.commit(); return {"imported":len(rows)}

@app.get("/exportar.json")
def export_json(s:Session=Depends(db)): return [MarkerOut.model_validate(x).model_dump() for x in s.scalars(select(Marker)).all()]

@app.get("/exportar.csv")
def export_csv(s:Session=Depends(db)):
    from fastapi.responses import StreamingResponse
    rows=s.scalars(select(Marker)).all(); out=io.StringIO(); w=csv.writer(out); w.writerow(["Nombre","Tipo","Departamento","Localidad","X","Y","Observaciones"])
    for x in rows:w.writerow([x.name,x.type,x.department,x.locality,x.lng,x.lat,x.notes])
    return StreamingResponse(iter([out.getvalue()]),media_type="text/csv",headers={"Content-Disposition":"attachment; filename=marcadores.csv"})
