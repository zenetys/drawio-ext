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
      ids: [],
      nodes: [],
      timeout: 0,
      isInit: false,
      graphId: ""
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
      live.graphId = "";
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

      /** Computes the request to call the API according to the given uri */
      function computeRequest(uri) {
        const liveApi = root.firstChild.getAttribute(live.api);

        return uri.startsWith("http") ? uri     // absolute path
        : uri.startsWith("/") ? liveApi + uri   // relative path
        : null;                                 // error
      }

      /** Checks recursively in xml tree if nodes are live ones & stores live nodes ids */
      function findLiveElementsIds(graphElement, idsList = []) {
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
            idsList.push(elementId);
          }
        }

        // if current element has children, finds live children
        if(graphElement.children.length > 0) {
          findLiveElementsIds(graphElement.firstChild, idsList);
        }
    
        // performs check for sibling
        const sibling = graphElement.nextElementSibling
        if(sibling !== null) {
          findLiveElementsIds(sibling, idsList);
        }
        return idsList;
      }
  
      /** stores xml nodes getted with their ids */
      function storeLiveElements(graph, ids) {
        const output = [];
        for(const elementId of ids) {
          const liveElement = graph.querySelector(`[id="${elementId}"]`);
          if(liveElement) {
            output.push({
              id: elementId,
              node: liveElement
            });
          }
        }
        return output;
      }

      // when inits or restarts
      if(!live.isInit) {
        live.ids = findLiveElementsIds(graph);
        live.nodes = storeLiveElements(graph, live.ids);
        live.isInit = true;
        live.timeout = +(root.firstChild.getAttribute(live.refresh) + "000");
        live.graphId = ui.currentPage.node.id;
      }

      // initiates the xml doc to perform the updates
      const xmlUpdatesDoc = mxUtils.createXmlDocument();
      const status = xmlUpdatesDoc.createElement("updates");
  
      for(const {node, id} of live.nodes) {
        let inputStyle = node.childNodes[0].getAttribute("style");

        const updateNode = xmlUpdatesDoc.createElement("update");
        updateNode.setAttribute("id", id);

        for(const attribute of node.attributes) {
          const {name, value: apiEndpoint} = attribute;
          const requestUrl = computeRequest(apiEndpoint);

          // targets all live properties
          if(name.startsWith("live.")) {
            try {
              const apiResponse = mxUtils.load(requestUrl);
              
              if(apiResponse) {
                let parsedResponse = apiResponse
                .getText()
                .replace(/"/g, "")
                .trim();

                if(name === live.text) {
                  updateNode.setAttribute(
                    "value", 
                    `<object label="${parsedResponse}"/>`
                  );
                } else if (name === live.style) {
                  updateNode.setAttribute(
                    "style", 
                    parsedResponse
                  );
                } else {
                  inputStyle = mxUtils.setStyle(
                    inputStyle, 
                    live.property.getName(name), 
                    parsedResponse
                  );
                  updateNode.setAttribute("style", inputStyle);
                }
              }
            }
            catch(e) {
              log(`Error while fetching data from ${requestUrl}: ${e}`);
            }
          }
        }
        status.appendChild(updateNode);
      }

      // appends "updates" node to the new doc & updates diagram with it
      if(ui.currentPage.node.id === live.graphId) {

        xmlUpdatesDoc.appendChild(status);
        ui.updateDiagram(
          mxUtils.getXml(xmlUpdatesDoc)
        );

        live.thread = setTimeout(
          doUpdate,
          live.timeout
        );
      }
      else {
        log("live update plugin: Page changed, plugin stopped");
        resetScheduleUpdate();
      }
    }

    function log(text) {
      console.log("liveUpdate plugin:", text);
    }
  }
);