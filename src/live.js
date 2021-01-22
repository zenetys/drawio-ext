/**
 * Live Update plugin.
 * Allows you to update separately each selected graph element.
 * 
 * Use "live.api" and "live.refresh" in the meta data of the diagram to configure 
 * the plugin:
 * 
 *    - live.api: url prefix to request the distant API (optional, see below).
 *    - live.refresh: interval between 2 updates, set in seconds (optional, 
 *      default is 10s).
 *    - Both are stored as attributes for the graph element with id = 0.
 * 
 * If you want a graph element becomes live updatable, you must add at least one 
 * of the following properties to the element (right click > "Edit Data" or 
 * CTRL+M):
 * 
 *    - live.text: updates element text node.
 *    - live.style: updates element style.
 *    - live.property.<PROPERTY_NAME>: updates element <PROPERTY_NAME> value.
 *        Example: "live.property.fillOpacity" updates "Fill Opacity" element 
 *        property.
 * 
 * The value for each live propertiy is the url used to get the requested resource.
 * The value can be an absolute path (ex: https://my.api/path/to/resource) or a 
 * relative path: in this case, stored value is concatenated with live.api prefix 
 * to build the request full url.
 * 
 * The APIs receiving requests MUST respond only a string corresponding to the 
 * updated value for the requested attribute:
 *    - "live.text" endpoint only returns updated displayed text.
 *    - "live.style" endpoint returns full updated element style.
 *    - "live.property.<PROPERTY_NAME>" endpoint only returns the updated value 
 *      for corresponding element property.
 * 
 * To handle live update behaviour, use the buttons stored in interface toolbar:
 * 
 *    - ⏺︎ (Play) : Starts the plugin feature.
 *    - ⏸ (Pause) : Stops the feature.
 *    - 🔄 (Restart) : Updates graph element & starts the feature.
 * 
 * If plugin is running on a page & you switch to another, plugin autostops.
 * 
 * Difference between Play & Restart: 
 * 
 * When played for first time, plugin stores the ids of all current graph live 
 * elements, to not have to fetch them each time there is an update. 
 * When Pause is clicked, live update feature is disabled but the stored ids stay, 
 * then id storage is not done when you click on Play. 
 * If the graph changes during the pause with live elements added or removed, you 
 * should click on Restart to perform the ids storage in the current graph & avoid 
 * troubles.
 */
Draw.loadPlugin(
  function(ui) {
    // stores live properties values
    const live = {
      thread: null,
      api: "live.api",
      refresh: "live.refresh",
      style: "live.style",
      text: "live.text",
      property: {
        prefix: "live.property.",
        getName: (fullPropName) => fullPropName.slice("live.property.".length)
      },
      nodes: [],
      timeout: 0,
      isInit: false,
      graphPageId: ""
    };

    addLiveUpdatePalette();

    /** Adds a new palette with buttons to handle the live state in the toolbar */
    function addLiveUpdatePalette() {
      if(!ui.toolbar) {
        log("Toolbar doesn't exist. Plugin is inactive...")
      }
      else {
        function addLiveButton(...buttons) {
          for(const button of buttons) {
            ui.toolbar.addMenuFunction(
              button.label,
              button.tooltip,
              true,
              button.funct,
              ui.toolbar.container
            );
          }
        }

        ui.toolbar.addSeparator();
        addLiveButton({
          label: "⏺︎",
          tooltip: "Start graph live update",
          funct: startScheduleUpdate
        },{
          label: "⏸",
          tooltip: "Stop graph live update",
          funct: pauseScheduleUpdate
        },{
          label: "🔄",
          tooltip: "Reload current graph & start live update",
          funct: restartScheduleUpdate
        });
        ui.toolbar.addSeparator();
      }
    }

    /** Stops refresh process & prevents multiple threads */
    function clearThread(threadId) {
      clearTimeout(threadId);
      live.thread = null;
    }

    /** "live-start" action handler */
    function startScheduleUpdate() {
      if(live.thread === null) {
        doUpdate();
      } else {
        log("live thread already running - thread id:", live.thread);
      }
    };

    /** "live-pause" action handler */
    function pauseScheduleUpdate() {
      clearThread(live.thread);
    }

    /** Resets live update parameters */
    function resetScheduleUpdate(isRestart = false) {
      live.ids = [];
      live.nodes = [];
      live.isInit = false;
      live.timeout = 0;
      live.graphPageId = "";
      clearThread(live.thread);

    }

    /** "live-restart" action handler */
    function restartScheduleUpdate() {
      resetScheduleUpdate();
      startScheduleUpdate();
    }

    /** Performs an update process */
    function doUpdate() {
      clearThread(live.thread);
      const graph = ui.editor.getGraphXml();
      const root = graph.firstChild;

      // when inits or restarts
      if(!live.isInit) {
        live.timeout = (+(root.firstChild.getAttribute(live.refresh) + "000")) || 10000;
        live.graphPageId = ui.currentPage.node.id;
        live.nodes = findLiveNodes(graph);
        live.isInit = true;
      }

      // initiates the xml doc to perform the updates
      const xmlUpdatesDoc = mxUtils.createXmlDocument();
      const updatesList = xmlUpdatesDoc.createElement("updates");
  
      for(const {node, id} of live.nodes) {
        let updateNode = xmlUpdatesDoc.createElement("update");
        updateNode.setAttribute("id", id);

        for(const attribute of node.attributes) {
          const {name: attrName, value: attrValue} = attribute;
          
          // targets all live properties
          if(attrName.startsWith("live.")) {
            // case: live value
            const updateOptions = {
              liveAttrName: attrName,
              url: computeRequest(attrValue, root.firstChild.getAttribute(live.api)),
              style: node.childNodes[0].getAttribute("style")
            };
            updateNode = fetchLiveValue(updateNode, updateOptions);
          }
        }
        updatesList.appendChild(updateNode);
      }

      // appends "updates" node to the new doc & updates diagram with it
      if(ui.currentPage.node.id === live.graphPageId) {

        xmlUpdatesDoc.appendChild(updatesList);
        ui.updateDiagram(
          mxUtils.getXml(xmlUpdatesDoc)
        );

        live.thread = setTimeout(
          doUpdate,
          live.timeout
        );
      }
      else {
        log("Page changed, plugin stopped");
        resetScheduleUpdate();
      }
    }

    /** Fecthes value from distant api for current attribute */
    function fetchLiveValue(currentLiveNode, options) {
      let {liveAttrName, url, style} = options;

      try {
        const apiResponse = mxUtils.load(url);
        
        if(apiResponse) {
          let parsedResponse = parseApiResponse(apiResponse);

          if(liveAttrName === live.text) {
            currentLiveNode.setAttribute(
              "value", 
              `<object label="${parsedResponse}"/>`
            );
          } else if (liveAttrName === live.style) {
            currentLiveNode.setAttribute(
              "style", 
              parsedResponse
            );
          } else {
            style = mxUtils.setStyle(
              style, 
              live.property.getName(liveAttrName), 
              parsedResponse
            );
            currentLiveNode.setAttribute("style", style);
          }
          return currentLiveNode;
        }
      }
      catch(e) {
        log(`Error while fetching data from ${requestUrl}: ${e}`);
      }
    }

    /** Parses received response from distant API */
    function parseApiResponse(response) {
      return response.getText().replace(/"/g, "").trim();
    } 

    /** Computes the request to call the API according to the given uri */
    function computeRequest(url, liveApi) {
      return url.startsWith("http") ? url     // absolute path
      : url.startsWith("/") ? liveApi + url   // relative path
      : null;                                 // error
    }

    /** Checks recursively in xml tree & stores nodes if they are live ones */
    function findLiveNodes(graphElement, liveNodes = []) {
      // node with id === 0 is not checked
      if(graphElement.getAttribute("id") !== "0") {
        const elementId = graphElement.getAttribute("id");

        // checks if current node is live
        let isLiveElement = false;
        for (const attribute of graphElement.attributes) {
          if(attribute.name.startsWith("live.")) {
            isLiveElement = true;
            break;
          }
        }

        // stores element id if element is live
        if(isLiveElement) {
          liveNodes.push({
            id: elementId,
            node: graphElement
          })
        }
      }

      // if current element has children, finds live children
      if(graphElement.children.length > 0) {
        liveNodes = findLiveNodes(graphElement.firstChild, liveNodes);
      }

      // performs check for sibling
      const sibling = graphElement.nextElementSibling
      if(sibling !== null) {
        liveNodes = findLiveNodes(sibling, liveNodes);
      }

      return liveNodes;
    }

    function log(text) {
      console.log("liveUpdate plugin:", text);
    }
  }
);