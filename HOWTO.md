# HOWTO

* Editer les data du graph: le noeud avec id=0 doit être un objet avec les attributs:
* updateUrl=<lien vers l'API> (sous la forme: '/api/drawio/<nomDeLaMethodeDuController>')
* updateTime=<interval entre les appels (en ms)>

## Mise à jour

Pour chaque objet du graph qui doit être update:
* Ajouter une propriété custom '_ref' à l'objet (clic droit > Edit Data)
* Lui donner une valeur qui permet de la discriminer dans le code pour pouvoir récupérer et update le node xml

Dans le code (./portal-server/src/controllers/drawioController.js):
* ajouter la méthode dans le controller
* créer une liste "refsList" contenant la valeur de '_ref' de tous les objets à update 
* DrawioController._getInputs( request.body.xml, ...flagsList );

Récupère un objet input avec pour chaque key (correspondant à la valeur donnée à '_ref') un objet full JS, donc facilement modifiable: `input[_ref] = { id, attr, style };`
* id: id de l'objet, permet d'update l'objet
* attr: liste des attributs, id, _ref, label, placeholder et autres attributs custom
* style: les attributs de style , pour nos objets custom, on cherche ici pour modifier des données le pourcentage d'une jauge par exemple est dans style.percentage

## EFFECTUER LES MODIFICATIONS

On  travaille sur l'objet reçu par _getInputs pour update le graph
* Dans une propriété value qu'on ajoute à l'objet pour modifier les propriétés de l'objet (placeholder, label,..)
* En modifiant les valeurs contenues dans la propriété style de l'input Pour les objets custom, c'est ce qu'on fait (en utilisant par exemple la propriété style.percentage pour modifier le pourcentage d'une jauge).

Une fois les modifs effectuées, envoyer la réponse:
* DrawioController._answer(response, updatedProps);
* response: méthode de l'API, qui sera utilisée pour renvoyer la réponse au format xml
* updatedProps: l'objet contenant les keys et mis à jour via le code

La méthode s'occupe de parser correctement les réponses aux bons formats, puis les renvoie au client. Les détails du fonctionnement des méthodes sont dans le code commenté.

L'update ne se fait QUE SUR les objets qui ont été indiqués

    cat zenLib_drawio.xml | xml2json  | jq -r .mxlibrary | jq -c '.[]' | while read ; do title=$(echo "$REPLY" | jq -r .title) ; echo "$REPLY" | jq . > $title.json ; done

    for json in *.json ; do ( printf "\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\x00" ; jq -r .xml < $json | base64 -d ; printf "\x00\x00\x00\x00\x00\x00\x00" ) | gzip -d 2>/dev/null | sed 's/+/ / ; s/%/\\\\x/g' | xargs printf %b | xml2json | jq . > ${json%.json}-raw.json ; done

    for file in *-raw.json ; do jq -r '.mxGraphModel.root.mxCell[2].style' < $file > ${file%-raw.json}.style; done

