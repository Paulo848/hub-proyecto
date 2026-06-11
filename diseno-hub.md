# Diseno del Hub Colaborativo

## Objetivo

Crear una pagina web liviana tipo hub colaborativo del proyecto, accesible desde cualquier navegador y sin instalar nada.

La pagina no reemplaza Google Drive ni otras herramientas. Los archivos siguen guardados en Drive, Docs, Sheets, Slides, Draw.io u otros servicios. La funcion del hub es centralizar el acceso a enlaces, notas y mensajes para evitar perder tiempo buscando informacion en WhatsApp, correo o carpetas sueltas.

## Alcance Inicial

El hub esta pensado solo para los integrantes del proyecto. No debe ser visible ni utilizable por cualquier persona con correo institucional.

La autorizacion real se basa en una lista global de miembros del hub.

## Pantallas Y Navegacion

La app debe organizarse en pantallas claras:

```txt
/login
/home
/workspace/:id
/profile
/history
/members
```

Si la app sigue siendo estatica y liviana, estas rutas pueden implementarse como vistas internas con JavaScript en vez de rutas reales.

### Login

Pantalla dedicada a autenticacion.

Debe cubrir:

```txt
iniciar sesion
crear cuenta
mostrar errores de autenticacion
redirigir segun estado del usuario
```

Flujo esperado:

```txt
1. Si el usuario no tiene sesion, ve login/registro.
2. Si inicia sesion pero no esta en hub_members, se muestra acceso denegado.
3. Si esta en hub_members pero no tiene nombre o color, se bloquea Home y se manda a completar perfil.
4. Si esta en hub_members y tiene perfil completo, entra a Home.
```

El color y el nombre deben pedirse despues de confirmar que el usuario esta autorizado como miembro del hub.

### Home

La Home es la vista general del hub.

Debe mostrar:

```txt
barra superior con nombre del hub
boton de perfil arriba a la derecha
panel de miembros del equipo
lista de workspaces
opcion para crear workspace
acceso a historial
acceso a miembros solo para jmoncadamo@unal.edu.co
```

La bolita de perfil arriba a la derecha representa al usuario actual con su color y nombre. Desde ahi se puede ir a Perfil o cerrar sesion.

La lista de miembros debe mostrarse como un panel separado, no como parte del menu de perfil, para que no se confunda el usuario actual con el equipo completo.

Nombre sugerido del panel:

```txt
Equipo
```

Cada miembro del equipo se muestra con:

```txt
color
nombre o apodo privado si existe
```

### Perfil

Pantalla para editar configuracion personal.

Debe permitir:

```txt
editar nombre propio
editar color propio
ver colores ocupados y por quien
gestionar apodos personales de otros miembros
cerrar sesion
```

No debe permitir editar nombre o color de otros miembros.

### Workspace

Pantalla de trabajo de un workspace especifico.

En desktop debe tener dos zonas principales:

```txt
izquierda: enlaces y recursos
derecha: chat
```

En movil debe apilarse o usar tabs:

```txt
Enlaces
Chat
```

La parte superior del workspace debe mostrar:

```txt
nombre del workspace
descripcion
creado por
ultima modificacion por
fecha de ultima modificacion
boton editar
boton eliminar
boton volver a Home
boton ver historial de este workspace
```

### Historial

Pantalla dedicada a trazabilidad.

Debe ser accesible desde Home y tambien desde cada workspace como acceso directo filtrado.

Flujos:

```txt
Home -> Historial
Workspace -> Ver historial de este workspace
```

Debe permitir:

```txt
seleccionar workspace
ver cambios de workspaces
ver cambios de enlaces
ver quien hizo cada cambio
ver fecha y hora
ver datos anteriores y nuevos cuando aplique
```

Para la primera version, basta con selector de workspace y lista de cambios.

### Miembros

Pantalla visible solo para:

```txt
jmoncadamo@unal.edu.co
```

Debe ser accesible solo desde Home.

Debe permitir:

```txt
ver miembros
agregar miembro por correo
quitar miembro
ver si un miembro tiene perfil completo o pendiente
```

No debe permitir que jmoncadamo@unal.edu.co edite nombre, color o apodos de otros miembros en la version inicial.

## Miembros Del Hub

Habra una lista global de correos autorizados:

```txt
hub_members
id
email
display_name
color
added_at
added_by
```

Reglas:

```txt
Solo los correos registrados en hub_members pueden usar la app.
Solo jmoncadamo@unal.edu.co puede agregar o quitar miembros del hub.
La opcion de administrar miembros solo se muestra a jmoncadamo@unal.edu.co.
Ningun miembro puede quedar sin nombre.
Ningun miembro puede quedar sin color.
```

Esta lista no es por workspace. Es global para todo el hub, porque el proyecto esta pensado para un equipo pequeno de aproximadamente 6 personas.

## Perfil Del Miembro

Cada miembro debe tener un perfil basico obligatorio.

El perfil incluye:

```txt
nombre
color
```

Si un miembro autorizado inicia sesion por primera vez y todavia no tiene nombre o color registrado, la app debe pedirle completar esos datos antes de permitirle usar el hub.

Reglas:

```txt
El nombre es obligatorio para todos los miembros.
El color es obligatorio para todos los miembros.
No se puede usar el hub sin nombre.
No se puede usar el hub sin color.
Home queda bloqueada hasta que el miembro complete nombre y color.
Cada miembro puede editar su propio nombre.
Cada miembro puede editar su propio color.
La regla tambien aplica para jmoncadamo@unal.edu.co.
jmoncadamo@unal.edu.co solo es administrador porque tiene opciones extra visibles.
El resto de reglas aplican igual para jmoncadamo@unal.edu.co salvo que se indique una excepcion explicitamente.
```

Campo sugerido:

```txt
hub_members.display_name
hub_members.color
```

## Colores De Miembros

Cada miembro debe escoger un color de una paleta limitada.

No se permite repetir colores entre miembros activos del hub.

La paleta sugerida tiene 12 colores:

```txt
Rojo
Naranja
Amarillo
Verde
Menta
Cian
Azul
Indigo
Morado
Rosa
Gris
Negro
```

Valores sugeridos:

```txt
red
orange
yellow
green
mint
cyan
blue
indigo
purple
pink
gray
black
```

Comportamiento en la interfaz:

```txt
Mostrar los 12 colores como opciones seleccionables.
Si un color ya esta ocupado, mostrar quien es el dueno.
No permitir seleccionar un color ocupado por otro miembro.
Bloquear el avance a Home si el usuario no tiene color.
Permitir conservar el color actual del usuario al editar su perfil.
Permitir cambiar a otro color libre.
```

Ejemplo:

```txt
Azul - ocupado por Juan
Verde - disponible
Morado - ocupado por Maria
```

## Apodos Personales

Cada miembro puede ponerle apodos a los demas miembros.

Los apodos son privados para quien los crea. Es decir, si el miembro 1 le pone un apodo al miembro 2, solo el miembro 1 ve al miembro 2 con ese apodo.

Ejemplo:

```txt
Miembro 1 tiene nombre: Uno
Miembro 2 tiene nombre: Dos
Miembro 1 le pone a Miembro 2 el apodo: "Dibujo"

Resultado:
Miembro 1 ve a Miembro 2 como "Dibujo".
Miembro 2 se sigue viendo como "Dos" para los demas miembros que no le pusieron ese apodo.
```

Tabla sugerida:

```txt
member_aliases
id
owner_email
target_email
alias
created_at
updated_at
```

Reglas:

```txt
Cada miembro puede crear, editar o eliminar sus propios apodos.
Un miembro solo puede ver los apodos que el mismo creo.
Los apodos no cambian el nombre real del miembro.
Si no existe apodo para una persona, se muestra su display_name.
```

## Permisos Generales

Cualquier miembro del hub puede:

```txt
ver workspaces
crear workspaces
editar workspaces
eliminar workspaces
ver enlaces
crear enlaces
editar enlaces
eliminar enlaces
ver notas
crear notas
editar notas
eliminar notas
leer mensajes
enviar mensajes
```

Restriccion especial para mensajes:

```txt
Solo quien creo un mensaje puede editarlo.
Solo quien creo un mensaje puede borrarlo.
```

No habra moderador especial de chat.

## Workspaces

Los workspaces son espacios de trabajo rapidos para cada clase, actividad o entrega.

Campos sugeridos:

```txt
workspaces
id
name
description
created_by
created_at
updated_by
updated_at
deleted_at
```

Cada workspace contiene:

```txt
enlaces
notas
chat
historial
```

Cualquier miembro del hub puede crear, editar o eliminar cualquier workspace.

La eliminacion de workspaces debe ser borrado logico:

```txt
deleted_at = now()
```

Los workspaces con `deleted_at` no deben aparecer en la vista principal, pero su informacion puede seguir existiendo para historial y trazabilidad.

En la vista principal, cada workspace debe mostrarse de forma simple con su estado actual:

```txt
nombre
descripcion
creado por
ultima modificacion por
fecha de ultima modificacion
boton para abrir
```

La vista principal no debe mostrar todos los cambios historicos. Los cambios historicos se consultan en la seccion de historial.

## Enlaces

Los enlaces son la parte central del hub. Sirven para guardar accesos a carpetas, documentos, presentaciones, hojas de calculo, diagramas y otros recursos externos.

Campos sugeridos:

```txt
workspace_links
id
workspace_id
title
url
type
note
created_by
created_at
updated_by
updated_at
deleted_at
```

Tipos sugeridos:

```txt
Drive
Docs
Sheets
Slides
Draw.io
PDF
GitHub
Otro
```

El tipo debe poder definirse de dos formas:

```txt
automaticamente segun la URL
manualmente por el usuario
```

Ejemplos de deteccion automatica:

```txt
drive.google.com -> Drive
docs.google.com/document -> Docs
docs.google.com/spreadsheets -> Sheets
docs.google.com/presentation -> Slides
app.diagrams.net -> Draw.io
draw.io -> Draw.io
github.com -> GitHub
archivo terminado en .pdf -> PDF
```

El tipo tambien debe poder editarse despues de crear el enlace.

Cualquier miembro del hub puede crear, editar o eliminar cualquier enlace.

La eliminacion de enlaces debe ser borrado logico:

```txt
deleted_at = now()
```

Los enlaces con `deleted_at` no deben aparecer en la vista principal del workspace, pero su informacion puede seguir existiendo para historial y trazabilidad.

En la vista principal del workspace, cada enlace debe mostrarse con su estado actual:

```txt
tipo
titulo
url
nota corta
creado por
ultima modificacion por
fecha de ultima modificacion
acciones disponibles
```

La vista principal no debe mostrar toda la trazabilidad del enlace. La trazabilidad detallada se consulta en la seccion de historial.

## Historial De Cambios

Por seguridad y trazabilidad, el hub debe guardar historial de cambios de workspaces y enlaces.

El historial debe mostrarse en una seccion dentro de cada workspace.

La seccion de historial es para ver cambios y trazabilidad. La pagina principal y la vista principal del workspace solo muestran el estado actual de cada cosa de manera sencilla.

Eventos sugeridos para workspaces:

```txt
workspace_created
workspace_updated
workspace_deleted
```

Eventos sugeridos para enlaces:

```txt
link_created
link_updated
link_deleted
```

Tabla sugerida:

```txt
activity_log
id
workspace_id
entity_type
entity_id
action
actor_email
old_data
new_data
created_at
```

Valores sugeridos para `entity_type`:

```txt
workspace
link
```

Comportamiento esperado:

```txt
Guardar quien hizo el cambio.
Guardar fecha y hora del cambio.
Guardar datos anteriores cuando aplique.
Guardar datos nuevos cuando aplique.
Mostrar el historial de mas reciente a mas antiguo.
Permitir ver el historial a cualquier miembro del hub.
No permitir editar ni borrar entradas del historial desde la interfaz.
```

Ejemplos de historial:

```txt
Juan cambio el nombre del workspace de "Parcial" a "Parcial final" - 10:35
Maria agrego el enlace "Carpeta Drive" - 10:40
Carlos cambio el tipo del enlace "Informe" de Docs a PDF - 11:12
```

## Chat

Cada workspace tiene su propio chat.

No hace falta una tabla separada de chats en la version inicial. Cada mensaje puede apuntar directamente al workspace.

Campos sugeridos:

```txt
workspace_messages
id
workspace_id
content
created_by
created_at
updated_at
deleted_at
```

Comportamiento esperado:

```txt
mostrar autor
mostrar color del autor junto al nombre como avatar
mostrar hora
ordenar mensajes de antiguo a reciente
permitir editar mensajes propios
permitir borrar mensajes propios
mostrar "Mensaje eliminado" cuando un mensaje fue borrado
```

Para borrar mensajes se recomienda borrado logico:

```txt
deleted_at = now()
content = ''
```

Asi se mantiene el historial basico del chat sin mostrar el contenido eliminado.

Visualmente, cada mensaje debe mostrar el color del miembro como si fuera su foto de perfil.

Ejemplo de presentacion:

```txt
[circulo azul] Juan  10:42
Mensaje del chat
```

Si el usuario que esta viendo el chat le puso un apodo al autor, se muestra el apodo. Si no tiene apodo, se muestra el nombre real del autor.

## Notas

Las notas sirven para informacion importante o estable dentro de un workspace.

Campos sugeridos:

```txt
workspace_notes
id
workspace_id
content
created_by
created_at
updated_at
```

Cualquier miembro del hub puede crear, editar o eliminar cualquier nota.

## Reglas De Seguridad

La regla principal debe ser:

```txt
El usuario autenticado solo puede usar la app si su email existe en hub_members.
```

La regla para administrar miembros debe ser:

```txt
Solo jmoncadamo@unal.edu.co puede insertar o eliminar registros en hub_members.
```

La regla para mensajes debe ser:

```txt
Los miembros del hub pueden leer todos los mensajes.
Los miembros del hub pueden crear mensajes.
Solo el creador de un mensaje puede editarlo.
Solo el creador de un mensaje puede marcarlo como eliminado.
```

## Version Inicial Funcional

Para una buena primera version, el orden recomendado de implementacion es:

```txt
1. Crear hub_members y cambiar las politicas RLS para usar miembros del hub.
2. Agregar administracion de miembros visible solo para jmoncadamo@unal.edu.co.
3. Agregar tipo de enlace automatico y editable.
4. Agregar editar/eliminar workspaces.
5. Agregar editar/eliminar enlaces.
6. Mejorar chat con autor, hora, editar y borrar mensajes propios.
7. Pulir estados vacios y mensajes de error en la interfaz.
```
