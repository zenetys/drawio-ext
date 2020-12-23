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
      isInit: false,
      statusBar: {
        id: "liveStatusBar",
        color: {
          start: "lightgreen",
          pause: "rgb(240, 135, 5)"
        }
      }
    }

    addLiveActions();
    addLiveUpdatePalette();


    /** Executes a binded action */
    function executeAction(actionName) {
      return function() {
        ui.actions.actions[actionName].funct();
      }
    }

    /** Adds live actions & handlers to the graph */
    function addLiveActions() {
      addLiveAction("live-start",   startScheduleUpdate);
      addLiveAction("live-pause",   pauseScheduleUpdate);
      addLiveAction("live-restart", restartScheduleUpdate);

      function addLiveAction(actionName, handler) {
        ui.actions.addAction(actionName, handler)
      }

      /** Updates status bar color according to the current state */
      function updateLiveStatus(color) {
        const liveStatusBar = document.getElementById(live.statusBar.id);
        liveStatusBar.style.backgroundColor = color;
      }

      /** "live-start" action handler */
      function startScheduleUpdate() {
        const graph = ui.editor.getGraphXml();
        const root = graph.firstChild;
        const liveRefresh = +(root.firstChild.getAttribute(live.refresh));

        console.log(liveRefresh, typeof liveRefresh)

        updateLiveStatus(live.statusBar.color.start);

        doUpdate();
        live.thread = setInterval(
          doUpdate,
          liveRefresh
        );
      };

      /** "live-pause" action handler */
      function pauseScheduleUpdate() {
        updateLiveStatus(live.statusBar.color.pause);
        clearInterval(live.thread);
      }

      /** "live-restart" action handler */
      function restartScheduleUpdate() {
        live.ids = [];
        live.nodes = [];
        live.isInit = false;

        startScheduleUpdate();
      };
    }

    /** Adds a new palette with buttons to handle the live state in the sidebar */
    function addLiveUpdatePalette() {
      if(ui.sidebar !== null) {
        const sidebarContainer = ui.sidebar.container;
  
        ui.sidebar.addPalette(
          "liveUpdate",
          "Live Update",
          true,
          function(palette) {
            function createLiveButton(text, actionName) {
              const liveButton = document.createElement('div');
              liveButton.innerText = text;
              liveButton.style.width = "25%";
              liveButton.style.textAlign = "center";
              liveButton.style.cursor = "pointer";
              liveButton.style.verticalAlign = "center";
              liveButton.style.padding = "5px";
              liveButton.style.margin = "0";
              liveButton.style.borderRadius = "5px";
              liveButton.style.border = "1px solid #aaa";
              
              const liveEvent = mxEvent.addListener(
                liveButton,
                (mxClient.IS_POINTER) ? "pointerup" : "mouseup",
                executeAction(actionName)
              );

              mxEvent.addListener(liveButton, mxWindow.CLOSE, function() {
                mxEvent.removeListener(liveEvent);
              })
  
              return liveButton;
            }
  
            const liveButtonsContainer = document.createElement("div");
            liveButtonsContainer.style.display = "flex";
            liveButtonsContainer.style.justifyContent = "space-around";
  
            const startButton = createLiveButton("Play", "live-start");
            const pauseButton = createLiveButton("Pause", "live-pause");
            const restartButton = createLiveButton("Restart", "live-restart");
  
            liveButtonsContainer.appendChild(startButton);
            liveButtonsContainer.appendChild(pauseButton);
            liveButtonsContainer.appendChild(restartButton);
            palette.appendChild(liveButtonsContainer);
  
            const statusBarId = live.statusBar.id;
            const liveStatusBar = document.createElement("div");
            liveStatusBar.style.width = "100%";
            liveStatusBar.style.height = "7px";
            liveStatusBar.style.marginTop = "3px";
            liveStatusBar.style.backgroundColor = live.statusBar.color.pause;
            liveStatusBar.id = statusBarId;
            palette.appendChild(liveStatusBar);
          }
        );
  
        // sets the new palette & its content to the top of the sidebar
        sidebarContainer.insertBefore(
          sidebarContainer.lastChild, 
          sidebarContainer.firstChild
        );
        sidebarContainer.insertBefore(
          sidebarContainer.lastChild, 
          sidebarContainer.firstChild
        );
      } 
    }

    /** Performs an update process */
    function doUpdate() {
      const graph = ui.editor.getGraphXml();      

      /** Computes the request to call the API according to the given uri */
      function computeRequest(graph, uri) {
        const root = graph.firstChild;
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
          const liveElement = graph.querySelector(`[id=${elementId}]`);
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
      }

      // initiates the xml doc to perform the updates
      const xmlUpdatesDoc = mxUtils.createXmlDocument();
      const status = xmlUpdatesDoc.createElement("updates");
  
      for(const {node, id} of live.nodes) {
        let style = "";
        let label = "";

        for(const attribute of node.attributes) {
          const {name, value: apiEndpoint} = attribute;
          const requestUrl = computeRequest(graph, apiEndpoint);

          // targets all live properties
          if(name.startsWith("live.")) {
            try {
              const apiResponse = mxUtils.load(requestUrl);
              
              if(apiResponse) {
                let parsedResponse = apiResponse
                .getText()
                .replace(/"/g, "")
                .trim();

                name === live.text ? label += `<object label="${parsedResponse}"/>`
                : style += (name === live.style) ? parsedResponse
                : `${
                  name.slice(
                    live.property.getName(name)
                  )
                }:${parsedResponse};`;
              }

            }
            catch(e) {
              console.log(`Error while fetching data from ${requestUrl}: ${e}`);
            }
          }
        }
        // sets fetched data in a update xml node & appends to "updates" node
        const updateNode = xmlUpdatesDoc.createElement("update");
        updateNode.setAttribute("id", id);
        style && updateNode.setAttribute(
          "style", 
          style
        );
        label && updateNode.setAttribute(
          "value", 
          label
        );   
        status.appendChild(updateNode);
      }

      // appends "updates" node to the new doc & updates diagram with it
      xmlUpdatesDoc.appendChild(status);
      ui.updateDiagram(
        mxUtils.getXml(xmlUpdatesDoc)
      );
    }
  }
);