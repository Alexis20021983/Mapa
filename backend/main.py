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
class Locality(Base):
    __tablename__="localities"
    id:Mapped[int]=mapped_column(Integer,primary_key=True,autoincrement=True)
    name:Mapped[str]=mapped_column(String(100),unique=True,index=True)
    latitude:Mapped[float]=mapped_column(Float)
    longitude:Mapped[float]=mapped_column(Float)
    department:Mapped[str]=mapped_column(String(100))
Base.metadata.create_all(engine)
LOCALITY_SEED=[("Santa Rosa",-36.6206,-64.2900,"Capital"),("Toay",-36.6830,-64.3780,"Toay"),("General Pico",-35.6566,-63.7568,"Maracó"),("General Acha",-37.3769,-64.6043,"Utracán"),("Eduardo Castex",-35.9150,-64.2940,"Conhelo"),("Realicó",-35.0360,-64.2440,"Realicó"),("Intendente Alvear",-35.2330,-63.5920,"Chapaleufú"),("Ingeniero Luiggi",-35.3850,-64.4660,"Realicó"),("General Campos",-37.4600,-63.5900,"Guatraché"),("Guatraché",-37.6670,-63.5330,"Guatraché"),("Macachín",-37.1360,-63.6680,"Atreucó"),("Quemú Quemú",-36.0540,-63.5650,"Quemú Quemú"),("Catriló",-36.4050,-63.4230,"Catriló"),("Lonquimay",-36.4670,-63.6240,"Catriló"),("Miguel Riglos",-36.8530,-63.6880,"Atreucó"),("Winifreda",-36.2270,-64.2330,"Conhelo"),("Victorica",-36.2150,-65.4350,"Loventué"),("Telén",-36.2650,-65.5100,"Loventué"),("Luan Toro",-36.9970,-65.7600,"Loventué"),("Santa Isabel",-36.2270,-66.9440,"Chical Có"),("La Humada",-36.3840,-68.0120,"Chical Có"),("25 de Mayo",-37.7790,-67.7160,"Puelén"),("Puelches",-38.1450,-65.9140,"Curacó"),("Bernasconi",-37.9040,-63.7400,"Hucal"),("Jacinto Arauz",-38.0870,-63.4310,"Hucal"),("General San Martín",-37.9790,-63.6020,"Hucal"),("Alpachiri",-37.3760,-63.7740,"Guatraché"),("Colonia Barón",-36.1510,-63.8550,"Quemú Quemú"),("Arata",-35.6390,-64.3570,"Trenel"),("Trenel",-35.6980,-64.1320,"Trenel"),("Parera",-35.1460,-64.5000,"Rancul"),("Rancul",-35.0690,-64.6820,"Rancul"),("Embajador Martini",-35.3860,-64.2810,"Realicó"),("Alta Italia",-35.3330,-64.1140,"Realicó"),("Anguil",-36.5260,-64.0110,"Capital"),("Uriburu",-36.5080,-63.8630,"Atreucó"),("Ataliva Roca",-36.8900,-64.3800,"Utracán"),("Doblas",-37.1490,-64.0130,"Atreucó"),("Monte Nievas",-35.8610,-64.1650,"Conhelo"),("Metileo",-35.7730,-63.9400,"Trenel"),("Dorila",-35.7690,-63.7240,"Maracó"),("Mauricio Mayer",-36.3630,-64.2720,"Conhelo"),("Conhelo",-36.0030,-64.5300,"Conhelo"),("La Adela",-38.9830,-64.0910,"Caleu Caleu"),("Gobernador Duval",-38.4630,-64.0160,"Curacó")]
with Session(engine) as seed_session:
    if not seed_session.scalar(select(Locality.id)):
        seed_session.add_all([Locality(name=name,latitude=lat,longitude=lng,department=department) for name,lat,lng,department in LOCALITY_SEED])
        seed_session.commit()
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
@app.get("/api/localidades")
@app.get("/localidades")
def list_localities(s:Session=Depends(db)):
    return [{"id":x.id,"name":x.name,"lat":x.latitude,"lng":x.longitude,"department":x.department} for x in s.scalars(select(Locality).order_by(Locality.name)).all()]
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
