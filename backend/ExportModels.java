import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

public class ExportModels {
  static Object field(Object value,String name)throws Exception{Class<?> c=value.getClass();while(c!=null){try{Field f=c.getDeclaredField(name);f.setAccessible(true);return f.get(value);}catch(NoSuchFieldException e){c=c.getSuperclass();}}throw new NoSuchFieldException(name);}
  static float number(Object value,String name)throws Exception{return ((Number)field(value,name)).floatValue();}
  static void quote(StringBuilder out,String s){out.append('"').append(s.replace("\\","\\\\").replace("\"","\\\"")).append('"');}
  static void part(StringBuilder out,Object p,String name)throws Exception{
    out.append("{\"name\":");quote(out,name);out.append(",\"pose\":[");
    String[] fields={"x","y","z","xRot","yRot","zRot","xScale","yScale","zScale"};
    for(int i=0;i<fields.length;i++){if(i>0)out.append(',');out.append(number(p,fields[i]));}out.append("],\"faces\":[");
    boolean first=true;for(Object cube:(List<?>)field(p,"cubes"))for(Object polygon:(Object[])field(cube,"polygons")){
      if(!first)out.append(',');first=false;out.append('[');boolean fv=true;
      for(Object vertex:(Object[])field(polygon,"vertices")){if(!fv)out.append(',');fv=false;Object pos=vertex;out.append('[').append(number(pos,"x")).append(',').append(number(pos,"y")).append(',').append(number(pos,"z")).append(',').append(number(vertex,"u")).append(',').append(number(vertex,"v")).append(']');}out.append(']');
    }out.append("],\"children\":[");first=true;
    for(Map.Entry<?,?> child:((Map<?,?>)field(p,"children")).entrySet()){if(!first)out.append(',');first=false;part(out,child.getValue(),String.valueOf(child.getKey()));}
    out.append("]}");
  }
  public static void main(String[] args)throws Exception{
    Class.forName("net.minecraft.SharedConstants").getMethod("tryDetectVersion").invoke(null);
    Class.forName("net.minecraft.server.Bootstrap").getMethod("bootStrap").invoke(null);
    Map<?,?> roots=(Map<?,?>)Class.forName("net.minecraft.client.model.geom.LayerDefinitions").getMethod("createRoots").invoke(null);
    Class<?> layers=Class.forName("net.minecraft.client.model.geom.ModelLayers");
    String[] keys={"PIG","PIG_BABY","COW","COW_BABY","CHICKEN","CHICKEN_BABY","SHEEP","SHEEP_WOOL","VILLAGER","ZOMBIE","HUSK","DROWNED","SKELETON","STRAY","WITHER_SKELETON","CREEPER","ENDERMAN","WOLF","CAT","IRON_GOLEM","SNOW_GOLEM","HORSE","DONKEY","RABBIT","SLIME","MAGMA_CUBE","ALLAY","BEE","FOX","TURTLE","SQUID","GLOW_SQUID","AXOLOTL","BAT","GOAT","POLAR_BEAR","MOOSHROOM","COLD_PIG","COLD_COW","WARM_COW","COLD_CHICKEN"};
    StringBuilder out=new StringBuilder("{\"format\":1,\"models\":{");boolean first=true;int count=0;
    for(String key:keys){try{
      Object loc=layers.getField(key).get(null),layer=roots.get(loc);if(layer==null)continue;
      Object baked=layer.getClass().getMethod("bakeRoot").invoke(layer);
      StringBuilder model=new StringBuilder();part(model,baked,"root");
      if(!first)out.append(',');first=false;quote(out,key.toLowerCase(Locale.ROOT));out.append(':').append(model);count++;
    }catch(NoSuchFieldException e){System.err.println("Unavailable layer: "+key+" / "+e.getMessage());}}
    if(count==0)throw new IllegalStateException("No supported client model layers found");
    out.append("}}");Files.writeString(Path.of(args[0]),out.toString());System.out.println("Exported model layers: "+count);
  }
}
