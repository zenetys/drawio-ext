Draw.loadPlugin(
  function(ui) {
    // stores live properties values
    const live = {
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
      thread: null,
      isInit: false,
    }

    displayLiveButtons();

    /** Builds & appends live controller buttons to the user window */
    function displayLiveButtons() {
      const targetSelector = ".geDiagramContainer";
      const containerId = "live-buttons-section";

      /** "Play" event listener */
      function scheduleUpdates() {
        const graph = ui.editor.getGraphXml();
        const root = graph.firstChild;
        const liveRefresh = +root.firstChild.getAttribute(live.refresh);

        styleContainerBg("lightgreen");

        doUpdate();
        live.thread = setInterval(
          () => doUpdate(),
          liveRefresh
        );
      };

      /** "Pause" event listener */
      function pauseSchedule() {
        styleContainerBg("orange");
        clearInterval(live.thread);
      }

      /** "Restart" event listener */
      function restartSchedule() {
        live.ids = [];
        live.nodes = [];
        live.isInit = false;

        scheduleUpdates();
      };

      /** Changes container bg color according to live state */
      function styleContainerBg(bgColor) {
        const container = document.getElementById(containerId);
        container.style.backgroundColor = bgColor;
      }

      /** Builds a live button to append to the container */
      function buildHtmlElement(type, text = null, onClickCallback = null, style, isContainer = false) {
        const htmlItem = document.createElement(type);
        
        if(isContainer) {
          htmlItem.setAttribute("id", containerId);
          const styleParams = Object.keys(style);
          
          for(const param of styleParams) {
            htmlItem.style[param] = style[param];
          }
        }
        else {
          if(text) htmlItem.innerText = text;
          if(onClickCallback) htmlItem.addEventListener(
            "click",
            onClickCallback
          );

          htmlItem.style.width = "30px";
          htmlItem.style.height = "30px";
          htmlItem.style.fontSize = "30px";
          htmlItem.style.textAlign = "left";
          htmlItem.style.padding = "0px";
          htmlItem.style.margin = "0px";
          htmlItem.style.cursor = "pointer";
        }

        return htmlItem;
      }

      const liveContainer = buildHtmlElement(
        "section", 
        null, 
        null, {
          position: "fixed",
          margin: "10px",
          borderRadius: "7px",
          left: "calc(50% - 90px)",
          width: "180px",
          height: "50px",
          backgroundColor: "orange",        
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",      
        },
        true
      );

      const playButton = buildHtmlElement(
        "div",
        "🔛",
        scheduleUpdates
      );

      const pauseButton = buildHtmlElement(
        "div",
        "⏸",
        pauseSchedule
      );

      const resetButton = buildHtmlElement(
        "div", 
        "↻",
        restartSchedule
      );

      // appends html elemts to the container & to the DOM
      liveContainer.appendChild(playButton);
      liveContainer.appendChild(pauseButton);
      liveContainer.appendChild(resetButton);
      const graphContainer = document.querySelector(targetSelector);
      graphContainer.appendChild(liveContainer);
    }


    /** Performs an update process */
    function doUpdate() {
      /** Computes the request to call the API according to the given uri */
      function computeRequest(graph, uri) {
        const root = graph.firstChild;
        const liveApi = root.firstChild.getAttribute(live.api);

        return uri.startsWith("http") ? uri     // absolute path
        : uri.startsWith("/") ? liveApi + uri   // relative path
        : null;                                 // error
      }

      /** checks reccursively in xml tree if nodes are live ones & stores live nodes ids */ 
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

      const graph = ui.editor.getGraphXml();

      // when init or restart
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