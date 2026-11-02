// Only public visual fields leave the full saved NBT payload on this endpoint.
export function entityAppearance(row){
  let p;try{p=JSON.parse(row.payload||'{}');}catch{p={};}
  const yaw=Number(p.Rotation?.[0]??p.rotation?.[0]??0);
  return {rowid:row.rowid,kind:'entity',id:row.id,x:row.x,y:row.y,z:row.z,
    yaw:Number.isFinite(yaw)?yaw:0,baby:Number(p.Age??p.age??0)<0,
    variant:String(p.variant??p['minecraft:variant']??p.Variant??p.CatType??p.RabbitType??'').slice(0,60),
    color:Number(p.Color??0),sheared:!!p.Sheared,profession:p.VillagerData?.profession||'',biome:p.VillagerData?.type||'minecraft:plains',
    invisible:!!p.Invisible};
}
const textures={
  cow:['cow/cow_temperate','cow/cow'],pig:['pig/pig_temperate','pig/pig'],sheep:['sheep/sheep'],
  chicken:['chicken/chicken_temperate','chicken'],villager:['villager/villager'],
  zombie:['zombie/zombie'],husk:['zombie/husk'],drowned:['zombie/drowned'],
  skeleton:['skeleton/skeleton'],stray:['skeleton/stray'],wither_skeleton:['skeleton/wither_skeleton'],
  creeper:['creeper/creeper'],enderman:['enderman/enderman'],
  wolf:['wolf/wolf_pale','wolf/wolf'],cat:['cat/cat_tabby'],
  iron_golem:['iron_golem/iron_golem'],snow_golem:['snow_golem/snow_golem','snow_golem'],
  horse:['horse/horse_brown'],donkey:['horse/donkey'],rabbit:['rabbit/rabbit_brown','rabbit/brown'],
  slime:['slime/slime'],magma_cube:['slime/magmacube'],allay:['allay/allay'],
  bee:['bee/bee'],fox:['fox/fox'],turtle:['turtle/turtle','turtle/big_sea_turtle'],
  squid:['squid/squid'],glow_squid:['squid/glow_squid'],axolotl:['axolotl/axolotl_lucy'],
  bat:['bat/bat','bat'],goat:['goat/goat'],polar_bear:['bear/polarbear'],mooshroom:['cow/mooshroom_red']
};
export function entityTexture(assets,type,options={}){
  if(!/^[a-z_]+$/.test(type))return null;
  const clean=value=>String(value||'').replace(/^minecraft:/,'');
  const variant=clean(options.variant),layer=clean(options.layer),baby=options.baby==='1',suffix=baby?'_baby':'';
  let candidates=[];
  if(['pig','cow','chicken'].includes(type)&&['cold','warm','temperate'].includes(variant))candidates.push(`${type}/${type}_${variant}${suffix}`);
  if(type==='cat'){
    const cats=['tabby','black','red','siamese','british_shorthair','calico','persian','ragdoll','white','jellie','all_black'];const name=/^\d+$/.test(variant)?cats[Number(variant)]:variant;
    if(cats.includes(name))candidates.push('cat/cat_'+name+suffix);
  }
  if(type==='wolf'&&['ashen','black','chestnut','rusty','snowy','spotted','striped','woods'].includes(variant))candidates.push('wolf/wolf_'+variant+suffix);
  if(type==='horse'&&/^\d+$/.test(variant)){
    const name=['white','creamy','chestnut','brown','black','gray','darkbrown'][Number(variant)&255];if(name)candidates.push('horse/horse_'+name+suffix);
  }
  if(type==='rabbit'){
    const name={0:'brown',1:'white',2:'black',3:'white_splotched',4:'gold',5:'salt',99:'caerbannog'}[variant];if(name)candidates.push('rabbit/rabbit_'+name+suffix,'rabbit/'+name);
  }
  if(type==='mooshroom'&&variant==='brown')candidates.push('cow/mooshroom_brown'+suffix);
  if(type==='sheep'&&layer==='wool')candidates=['sheep/sheep_wool'+suffix,'sheep/sheep_fur'+suffix];
  else if(type==='villager'&&layer==='biome'&&['plains','desert','jungle','savanna','snow','swamp','taiga'].includes(variant))candidates=['villager/type/'+variant];
  else if(type==='villager'&&layer==='profession'&&['armorer','butcher','cartographer','cleric','farmer','fisherman','fletcher','leatherworker','librarian','mason','nitwit','shepherd','toolsmith','weaponsmith'].includes(variant))candidates=['villager/profession/'+variant];
  else if(type==='enderman'&&layer==='eyes')candidates=['enderman/enderman_eyes'];
  else if(layer)return null;
  else {if(baby)candidates.push(...(textures[type]||[]).map(n=>n+'_baby'));candidates.push(...(textures[type]||[]));}
  for(const name of candidates){const bytes=assets?.read(`assets/minecraft/textures/entity/${name}.png`);if(bytes)return bytes;}
  return null;
}
