/**
 * Live Update plugin.
 *
 * Allows you to update separately each selected graph element.
 * Use live attributes to configure the plugin.
 *
 * In the metadata of the diagram (graph element with id = 0)
 *    - LIVE_API: url prefix to request the distant API (optional, see below).
 *    - LIVE_REFRESH: interval between 2 updates, set in seconds (optional,
 *      default is 10s).
 *
 * In the graph objects properties (right click > "Edit Data" or
 * CTRL+M):
 *    - LIVE_DATA: calls a complex API (returning an object)
 *    - LIVE_TEXT: updates element text node.
 *    - LIVE_STYLE: updates element style.
 *    - live.property.<PROPERTY_NAME>: updates element <PROPERTY_NAME> value.
 *        Example: "live.property.fillOpacity" updates "Fill Opacity" element
 *        property.
 *
 * See documentation for more details.
 */
 Draw.loadPlugin(
  function(ui) {
    const LIVE_USERNAME = "live.username";
    const LIVE_APIKEY = "live.apikey";
    const LIVE_PASSWORD = "live.password";
    const LIVE_API = "live.api";
    const LIVE_APITYPE = "live.apitype";
    const LIVE_REFRESH = "live.refresh";
    const LIVE_STYLE = "live.style";
    const LIVE_TEXT = "live.text";
    const LIVE_TOOLTIP = "live.tooltip";
    const LIVE_DATA = "live.data";
    const LIVE_SOURCE = "live.source";
    const LIVE_REF = "live.id";
    const LIVE_HANDLERS = "live.handlers";

    const live = {
      isRunning: false,
      pageBaseId: undefined,
      thread: null,
      timeout: 0,
      nodes: [],
      handlers: {
        list: {},
        parsed: {},
        separators: { list: "---", pair: ":" }
      },
      apitypes: [
      ],
      warnings: {},
      property: {
        prefix: "live.property.",
        getName: (fullPropName) => fullPropName.slice(live.property.prefix.length)
      },
      /**
       * Checks if targetted live attribute handles an anonymous api
       * receiving the updates value or if it contains js instructions
       * to fetch updated value managing named APIs
       * @param {string} attribute Targetted attribute value
       * @returns {boolean} true if attribute references an anonymous API
       */
      isAnonAttribute: (attribute) => !attribute.startsWith("="),

      /**
       * Checks if targetted attribute is a live attribute
       * @param {string} attribute Targetted attribute name
       * @returns {boolean} true if attribute is live
       */
      isLiveAttribute: (attribute) => live.all.includes(attribute) || live.isLiveProperty(attribute),
      // isLiveAttribute: (attribute) => attribute.startsWith("live."),

      /**
       * Chacks if targetted attribute corresponds to an object's live property
       * @param {string} attribute Targetted attribute name
       * @returns {boolean} true if attribute is an object's live property
       */
      isLiveProperty: (attribute) => attribute.startsWith(live.property.prefix),

      /**
       * Checks if targetted attribute is a live attribute & if it's not an unavailable one
       * @param {string} attribute Targetted attribut ename
       * @returns {boolean} True if attribute is an available live one
       */
      isAvailableLiveAttribute: (attribute) => {
        if(!live.isLiveAttribute(attribute)) return false;
        else {
          for(const unavailableLiveAttribute of live.unavailables) {
            if(attribute === unavailableLiveAttribute) return false;
          }
          return true;
        }
      },
      mxUtilsRequestErrorMsg: "{\"status\": \"error\"}",
      formatPanel: {
        arePropertiesShown: false,
        isDisplayed: false,
      },
      paletteButtons: {
        start: ["⏺︎","Start graph live update",startScheduleUpdate],
        pause: ["⏸","Stop graph live update",pauseScheduleUpdate],
        reload:["🔄","Reload graph live data",singleUpdate],
      },
      all: [
        LIVE_USERNAME,  // "username" credential
        LIVE_APIKEY,    // "apikey" credential
        LIVE_PASSWORD,  // "password" credential
        LIVE_API,       // root url
        LIVE_APITYPE,   // if set, corresponds to a specific API (LIVE_SOURCE is autoset)
        LIVE_REFRESH,   // time between 2 API calls in seconds
        LIVE_STYLE,     // graph node's style
        LIVE_TEXT,      // graph node's text
        LIVE_TOOLTIP,   // graph node's tooltip
        LIVE_DATA,      // Graph node API
        LIVE_SOURCE,    // path from received API response to get source object (autoset if LIVE_APITYPE is set)
        LIVE_REF,       // Reference associated with API stored in graph object LIVE_SOURCE
        LIVE_HANDLERS,  // Array containing user defined methods stored in graph root node
      ],
      credentials: [LIVE_USERNAME, LIVE_PASSWORD, LIVE_APIKEY],
      unavailables: [
        LIVE_API,
        LIVE_REFRESH,
        LIVE_USERNAME,
        LIVE_APIKEY,
        LIVE_PASSWORD,
        LIVE_DATA,
        LIVE_SOURCE,
        LIVE_APITYPE,
        LIVE_REF,
        LIVE_HANDLERS,
      ]
    };

    /** Launches "Live" feature in webapp */
    function initPlugin() {
      /* Intercept "load" event sent from draw.io (us) to our parent window
       * in embed mode. In embed mode, no "fileLoaded" gets fired, however
       * we need an event to fire when the diagram has been setup in order
       * to initialize live.pageBaseId. */
      function addEmbedLoadListener(cb) {
        let parentWindow = window.opener || window.parent;
        parentWindow?.addEventListener("message", function (ev) {
          if (ev.source !== window || typeof ev.data !== "string")
            return; /* ignore */
          /* Cheap way of checking a "load" event in ev.data because JSON
           * may be heavy to parse since it contains the diagram XML. */
          if (ev.data.substring(0,16) == '{"event":"load",')
            cb(ev);
        });
      }

      if (ui.editor.isChromelessView()) {
          /* Autostart live updates in chromeless mode. Note: updates get
           * stopped before to handle page changes or diagram loads via
           * hash tags. */

          // embed mode
          addEmbedLoadListener(function (ev) {
            log("Got embed load event, start live updates");
            pauseScheduleUpdate();
            startScheduleUpdate();
          });

          // classic file mode
          ui.editor.addListener(undefined, function(editor, ev) {
            if (ev.name == "fileLoaded" || ev.name == "pageSelected") {
              log("Got " + ev.name + " event, start live updates");
              pauseScheduleUpdate();
              startScheduleUpdate();
            }
          });
      }
      else {
        ui.format.showCloseButton = false;

        function resetLiveEditor() {
          if (ui && ui.currentPage && ui.currentPage.root) {
            const currentPageBaseId = ui.currentPage.root.getId();
            if (live.pageBaseId !== currentPageBaseId) {
              if (live.thread) {
                log("Refresh feature stopped due to page change");
                pauseScheduleUpdate();
              }
              // Reset live base data
              live.pageBaseId = ui.currentPage.root.getId();
              log("Base ID after page change event:", live.pageBaseId)
            }
          }
          if (!ui.isLivePluginEnabled) {
            ui.isLivePluginEnabled = true;
            addLiveUpdatePalette();
            overrideFormatPanelRefresh();
            addLiveTabToFormatPanel();
            storeHandlers();
          }
        }

        /* Adds a listeners to (re)initialize the plugin and stop the ongoing
         * update process when a diagram is loaded, including when a page has
         * changed. */

        // embed mode
        addEmbedLoadListener(function (ev) {
          log("Got embed load event, reset editor");
          resetLiveEditor();
        });

        // classic file mode
        ui.editor.addListener(undefined, function(editor, ev) {
          if (ev.name == "fileLoaded" || ev.name == "pageSelected") {
            log("Got " + ev.name + " event, reset editor");
            resetLiveEditor();
          }
        });

        /** Adds a listener to stop update process when a graph node is selected */
        ui.editor.graph.selectionModel.addListener(undefined, function(a,b,c) {
          const isSelectionEmpty = ui.editor.graph.isSelectionEmpty();
          const { isRunning } = live;
          if(isRunning && !isSelectionEmpty) pauseScheduleUpdate();
        });
      }
    }

    /** Adds a new palette with buttons to handle the live feature state in the toolbar */
    function addLiveUpdatePalette() {
      if(!ui.toolbar)
        log("Toolbar doesn't exist. Plugin is inactive...")
      else {
        ui.toolbar.addSeparator();
        updateLivePalette(false, true);
      }
    }

    /** Adds "Live" custom format tab in Format Panel */
    function addLiveTabToFormatPanel() {
      const formatContainer = document.querySelector(".geFormatContainer");
      const formatTabs = formatContainer?.firstChild;
      if (!formatTabs)
        return; /* ui not ready yet? */
      if (formatTabs.querySelector(":scope > .live-format-tab") !== null) {
        log("BUG: Live format tab already present, skip creation");
        return;
      }

      const formatWidth = parseInt(formatContainer.style.width);
      const formatTabsNb = formatTabs.childNodes.length;

      // Adds tab only if formatWidth > 0 === format panel is displayed
      if (formatWidth <= 0)
        return;

      const tabLength = parseInt(formatWidth / (formatTabsNb + 1));
      for (const tab of formatTabs.children) {
        tab.style.width = tabLength + "px";
      }

      /**
       * Sets Format Panel tab style, depending
       * on if current tab is focused one or not
       * @param {HTMLElement} elt Format Panel tab
       * @param {boolean} isActiveTab True if selected tab is active one
       * @param {number} tab index
       */
      function setTabStyle(elt, isActiveTab = false, index) {
        elt.style.backgroundColor = isActiveTab ? "inherit" : Format.inactiveTabBackgroundColor;
        elt.style.borderBottomWidth = isActiveTab ? "0px" : "1px";
        if (index > 0 && isActiveTab && !ui.editor.graph.isSelectionEmpty())
          elt.style.borderLeftWidth = "1px";
      }

      const liveTab = formatTabs.firstChild.cloneNode(false);
      liveTab.style.width = tabLength;
      liveTab.classList.add("live-format-tab");
      setTabStyle(liveTab);
      mxUtils.write(liveTab, "Live");
      formatTabs.appendChild(liveTab);

      let liveContent = undefined;

      /**
       * Listener called at "click" on format panel tabs
       * Displays Live Format Panel if liveTab is clicked
       * @param {HTMLElement} targettedTab Format Panel clicked tab
       */
      function handleLiveFormatPanelDisplay(targettedTab) {
        // remove previous panel if any
        liveContent?.remove();

        if (targettedTab === liveTab) {
          /* Building the panel depends on identification of selected node
           * or page root id, hence may still fail when transitioning from
           * one diagram to another when the live tab is opened. In such
           * case just skip it. */
          liveContent = buildLiveFormatPanelContent();
          if (!liveContent)
            return;

          // selected tab is Live => display Live Format Panel
          live.formatPanel.isDisplayed = true;
          liveContent.style.display = "block";
          formatContainer.appendChild(liveContent);

          for (let t = 0; t < formatTabs.children.length; t++) {
            setTabStyle(formatTabs.children[t], formatTabs.children[t] === liveTab, t);
          }

          for (const content of formatContainer.childNodes) {
            if (content !== formatTabs) {
              content.style.display = (content === liveContent) ? "block" : "none";
            }
          }
        }
        else {
          // Hides Live panel & display selected one
          live.formatPanel.isDisplayed = false;
          setTabStyle(liveTab);

          // Sets focused tab style & displays its content
          const tabs = Array.from(formatTabs.childNodes);
          if (tabs) {
            const focusedTabId = tabs.findIndex(tab => (tab === targettedTab));
            if (ui.format.panels[focusedTabId]) {
              ui.format.panels[focusedTabId].container.style.display = "block";
              setTabStyle(targettedTab, true);
            }
          }
        }
      }

      if (live.formatPanel.isDisplayed)
        handleLiveFormatPanelDisplay(liveTab);

      mxEvent.addListener(formatTabs, "click", function(e) {
        handleLiveFormatPanelDisplay(e.target);
      });
    }

    /** Overrides format panel reshresh event to add Live tab */
    function overrideFormatPanelRefresh() {
      const formatRefreshBasicFunc = ui.format.immediateRefresh;
      ui.format.immediateRefresh = function() {
        mxUtils.bind(ui.format, formatRefreshBasicFunc)();
        if(!ui.editor.graph.isEditing())
          addLiveTabToFormatPanel();
      }
    }

    /** Builds content in Live Format Panel */
    function buildLiveFormatPanelContent() {
      const graphXml = ui.editor.getGraphXml();
      const graph = ui.editor.graph;
      const liveFormatPanelContainer = document.createElement('section');
      let targetId = undefined;

      if (graph.isSelectionEmpty())
        targetId = live.pageBaseId;
      else
        targetId = graph.selectionModel.cells[0].getId();

      const target = mxUtils.findNode(graphXml, "id", targetId);
      if (!target)
        return;

      const isSelectionMode = !graph.isSelectionEmpty();

      /**
       * Builds an input section in the Live format panel
       * @param {"property"|"handler"} type Selects if inputs are for live properties or handlers
       * @param {string} labelStr Text displayed in input field: attribute parsed name or handler name
       * @param {string} attrName Input's corresponding live attribute name or handler value
       * @param {string} targetId Targetted graph node id (empty if in handler type)
       * @returns {object} Set of all HTML elements for the input
       */
      function buildInput(type, labelStr, attrName, target, withWarning) {
        if (type === "property" && !target) {
          return {
            cb: null,
            shortField: null,
            longField: null,
            label: null
          };
        }

        const targetId = target.getAttribute("id");
        const emptyValue = "";
        const base = mxUtils.findNode(graphXml, "id", live.pageBaseId);
        const attrValue = (
          (type === "handler" ? attrName : target.getAttribute(attrName)) || null
        );

        const cb = document.createElement('input');
        cb.setAttribute('type', 'checkbox');
        cb.style.margin = '3px 3px 0px 0px';
        cb.checked = attrValue;
        cb.title = (cb.checked ? "Remove " : "Add ") + type;

        const customCb = document.createElement("span");
        customCb.style.width = "10px";
        customCb.style.height = "10px";
        customCb.style.margin = "0px 3px 0px 0px";
        customCb.style.padding = "0px";
        customCb.style.border = "1px solid " + (withWarning ? "#FA0" : "#aaa");

        if (cb.checked)
          customCb.style.backgroundColor = withWarning ? "#FC0" : "#ccc";

        const label = document.createElement("label");
        label.style.textOverflow = "ellipsis";
        label.style.paddingTop = "3px";
        label.style.lineHeight = "12px";
        mxUtils.write(label, labelStr + (withWarning ? " ⚠" : ""));

        /**
         * Creates an input or textarea field depending on hrmlTag value
         * @param {string} htmlTag HTML node name
         * @returns {HTMLElement} Created node
         */
        function createField(htmlTag) {
          const elt = document.createElement(htmlTag);
          elt.value = attrValue;
          elt.style.boxSizing = "border-box";
          elt.style.margin = "0";
          elt.style.padding = "0";
          elt.style.border = `1px ${attrValue ? "solid":"dashed"} #aaa`;
          elt.style.backgroundColor = Format.inactiveTabBackgroundColor;
          elt.style.borderRadius = "0px";
          elt.style.fontStyle = (attrValue) ? "normal" : "italic";
          if (htmlTag === "input") {
            elt.style.width = "50%";
            elt.type = "text";
            elt.style.height = "20px";
            elt.style.float = "right";
            elt.style.marginLeft = "auto";
            elt.style.paddingLeft = "2px";
          }
          else if (htmlTag === "textarea") {
            elt.style.width = "100%";
            elt.rows = 5;
            elt.style.resize = "vertical";
            elt.style.display = "none";
            elt.style.outline = "none";
          }

          /**
           * Computes placeholder for "source" live format panel input.
           * Checks depend on nodes **LIVE_APITYPE** & **LIVE_SOURCE** attributes
           * @param {Node} target Targetted graph node
           * @param {Node} base Graph base node
           * @returns {string} Computed placeholder or default empty value
           */
          function getSourcePlaceholder(target, base) {
            /**
             * Computes source placeholder depending on
             * checked node **LIVE_APITYPE** attribute value
             * @param {Node} elt Current checked node
             */
            function checkApitype(elt) {
              if (elt.hasAttribute(LIVE_APITYPE)) {
                const apiType = live.apitypes.find(
                  (api) => (api.id === elt.getAttribute(LIVE_APITYPE))
                );

                if (apiType) {
                  return `api ${apiType.id} => ${apiType.source || "Function"}`;
                }
              }
              return false;
            }

            if (checkApitype(target))
              return checkApitype(target);
            else if (checkApitype(base))
              return checkApitype(base);
            else if (base.hasAttribute(LIVE_SOURCE))
              return base.getAttribute(LIVE_SOURCE);

            return emptyValue;
          }

          if (attrName === LIVE_APITYPE)
            elt.placeholder = "raw";
          else if (attrName === LIVE_SOURCE)
            elt.placeholder = getSourcePlaceholder(target, base);
          else if (base.hasAttribute(attrName))
            elt.placeholder = base.getAttribute(attrName);
          else
            elt.placeholder = emptyValue;

          return elt;
        }

        const shortField = createField("input");
        const longField = createField("textarea");

        // INPUTS EVENT HANDLERS //
        function handleKeyDownOnTextInput(e) {
          if (e.key === "Enter" || e.key === "Escape") {
            if (e.key === "Escape")
              longField.value = attrValue;
            document.activeElement.blur();
          }
        }

        function handleFocusoutOfTextInput() {
          let initialValue = undefined;

          if (type === "property")
            initialValue = target.getAttribute(attrName) || "";

          if (type === "handler")
            initialValue = live.handlers.list[labelStr] || "";

          if (initialValue !== longField.value)
            updateGraph(targetId, type, (type === "handler" ? labelStr : attrName), longField.value);

          longField.style.display = "none";
          shortField.style.display = "inline";
        }

        function handleClickOnCheckbox(e) {
          e.preventDefault();
          if (!e.target.checked) {
            const propName = type === "handler" ? labelStr : attrName;
            if (mxUtils.confirm("Are you sure to remove " + propName + " " + type + " ?")) {
              updateGraph(targetId, type, propName);
            }
          }
          else {
            shortField.focus();
          }
        }

        function handleFocusOnShortField(e) {
          e.preventDefault();
          shortField.style.display = "none";
          longField.style.display = "block";
          longField.focus();
        }

        function handleClickOnLabel(e) {
          e.preventDefault();
          if (cb.checked) {
            const propName = type === "handler" ? labelStr : attrName;
            if (mxUtils.confirm("Are you sure to remove " + propName + " " + type + " ?")) {
              cb.checked = !cb.checked;
              updateGraph(targetId, type, propName);
            }
          }
          else {
            shortField.focus();
          }
        }

        mxEvent.addListener(cb, "click", handleClickOnCheckbox);
        mxEvent.addListener(customCb, "click", handleClickOnLabel);
        mxEvent.addListener(label, "click", handleClickOnLabel);
        mxEvent.addListener(shortField, "focus", handleFocusOnShortField);
        mxEvent.addListener(longField, "keydown", handleKeyDownOnTextInput);
        mxEvent.addListener(longField, "focusout", handleFocusoutOfTextInput);

        return { cb: customCb, label, longField, shortField };
      }

      /**
       * Builds inputs then appends its to the Live format panel container
       * @param {Array<object>} inputsList List of data for the input build
       * @param {"classic"|"handler"} type Selects if inputs are for live attrs or handlers
       * @param {HTMLElement} container Inputs HTML container
       * @param {Node} targetId Targetted graph node
       */
      function handleSubpanelInputs(container, type, target, inputsList) {
        for (const input of inputsList) {
          const [displayedLabel, attributeName] = input;

          const inputSection = document.createElement('section');
          inputSection.style.padding = '6px 0px 1px 1px';
          inputSection.style.whiteSpace = 'nowrap';
          inputSection.style.overflow = 'hidden';
          inputSection.style.fontWeight = "normal";
          inputSection.style.display = "flex";
          inputSection.style.flexWrap = "wrap";
          inputSection.style.justifyContent = "flex-start";
          inputSection.style.alignItems = "center";

          const warning = getWarning(
            type === "handler" ? "handler" : attributeName,
            type === "handler" ? displayedLabel : target.getAttribute("id")
          );

          if (warning)
            inputSection.title = warning;

          const { cb, shortField, longField, label } =
            buildInput(type, displayedLabel, attributeName, target, Boolean(warning));

          inputSection.append(cb, label, shortField, longField);
          container.appendChild(inputSection);
        }
      }

      /**
       * Builds a subpanel in the Live Format Panel
       * @param {string} title Subpanel title
       * @param {Node} target Targetted graph node
       * @param {boolean} isSelectionMode True if a node is selected in the graph
       * @returns The built subpanel
       */
      function buildSubpanel(title, target, isSelectionMode = false) {
        const subpanelContainer = new BaseFormatPanel().createPanel();
        subpanelContainer.style.padding = "12px";
        const titleContainer = new BaseFormatPanel().createTitle(title);
        titleContainer.style.width = "100%";
        subpanelContainer.appendChild(titleContainer);

        if (title !== "Properties" && title !== "Handlers") {
          const baseInputs = [
            ["API", LIVE_API],
            ["API Type", LIVE_APITYPE],
            ["Username", LIVE_USERNAME],
            ["Password", LIVE_PASSWORD],
            ["API Key", LIVE_APIKEY],
            ["Source", LIVE_SOURCE],
            ["Refresh", LIVE_REFRESH],
          ];
          const graphNodeInputs = [
            // Displayed only if a node is selected in the graph
            ["Object", LIVE_DATA],
            ["API ID", LIVE_REF],
            ["Text", LIVE_TEXT],
            ["Tooltip", LIVE_TOOLTIP],
            ["Style", LIVE_STYLE],
          ];

          handleSubpanelInputs(subpanelContainer, "property", target, baseInputs);
          if (isSelectionMode) {
            handleSubpanelInputs(subpanelContainer, "property", target, graphNodeInputs);
          }
        }
        else {
          if (title === "Properties") {
            const propertyInputs = [];
            for (const attr of target.attributes) {
              if (live.isLiveProperty(attr.name)) {
                const newLiveProperty = [
                  live.property.getName(attr.name),
                  attr.name
                ];
                propertyInputs.push(newLiveProperty);
              }
            }
            handleSubpanelInputs(subpanelContainer, "property", target, propertyInputs);
          }
          else if (title === "Handlers") {
            const handlerInputs = [];
            Object.keys(live.handlers.list).forEach(handlerName => handlerInputs.push([
              handlerName,
              live.handlers.list[handlerName]
            ]));
            handleSubpanelInputs(subpanelContainer, "handler", target, handlerInputs);

          }
        }
        return subpanelContainer;
      }

      /**
       * Builds a form in the Live format panel
       * @param {"property"|"handler"} type If form is for new property o new handler
       * @param {string} targetId Targetted graph object's id
       */
      function buildFormatPanelForm(type, targetId) {
        const getLabel = (property) => {
          const Type = type[0].toUpperCase() + type.slice(1);
          const labels = {
            title: "Add Live " + Type,
            validate: "Confirm",
            placeholder: Type + " ",
            error: "New " + type + " must have a "
          }
          return labels[property];
        }

        const formContainer = new BaseFormatPanel().createPanel();
        const title = new BaseFormatPanel().createTitle(getLabel("title"));
        formContainer.appendChild(title);
        formContainer.style.padding = "12px";
        formContainer.style.textAlign = "center";
        const inputs = {};

        for (const key of ["name", "value"]) {
          const input = document.createElement("input");
          input.type = "text";
          input.style.display = "block";
          input.style.width = "100%";
          input.style.height = "30px";
          input.style.boxSizing = "border-box";
          input.style.borderRadius = "0px";
          input.style.border = "1px solid #aaa";
          input.style.backgroundColor = Format.inactiveTabBackgroundColor;
          input.style.marginBottom = "10px";
          input.placeholder = getLabel("placeholder") + key;

          formContainer.appendChild(input);
          inputs[key] = input;
        }

        const validateBtn = document.createElement("button");
        mxUtils.write(validateBtn, getLabel("validate"));
        validateBtn.style.width = "80%";

        function validateForm() {
          const nameFieldIsEmpty = (inputs.name.value === "");
          const valueFieldIsEmpty = (inputs.value.value === "");
          const namme = (type === "property" ? live.property.prefix : "") + inputs.name.value.trim();
          if ((!nameFieldIsEmpty) && (!valueFieldIsEmpty)) {
            updateGraph(targetId, type, namme, inputs.value.value.trim());
            inputs.name.value = "";
            inputs.value.value = "";
          }
          else {
            if (nameFieldIsEmpty)
              log(getLabel("error") + "name!");
            if (valueFieldIsEmpty)
              log(getLabel("error") + "value!");
          }
        }

        function handleKeyDownOnInput(e) {
          if (e.key === "Enter")
            validateForm();
        }

        mxEvent.addListener(validateBtn, mxEvent.CLICK, validateForm);
        mxEvent.addListener(inputs.name, "keydown", handleKeyDownOnInput);
        mxEvent.addListener(inputs.value, "keydown", handleKeyDownOnInput);

        formContainer.appendChild(validateBtn);
        return formContainer;
      }

      liveFormatPanelContainer.appendChild(
        buildSubpanel(
          (targetId === live.pageBaseId) ? "Diagram" : "Object " + targetId,
          target,
          isSelectionMode
        )
      );

      if (isSelectionMode) {
        liveFormatPanelContainer.append(
          buildSubpanel("Properties", target),
          buildFormatPanelForm("property", targetId)
        );
      }
      else {
        liveFormatPanelContainer.append(
          buildSubpanel("Handlers", target),
          buildFormatPanelForm("handler", targetId)
        );
      }

      return liveFormatPanelContainer;
    }

    /**
     * Updates the xml graph using format panel components.
     * Updates nodes live properties or handlers depending on affected type
     * @param {string} targetId Targetted graph node id
     * @param {"property"|"handler"} type Defines kind of update
     * @param {string} name Name of the attribute to update or of the handler
     * @param {string} value Corresponding value
     */
    function updateGraph(targetId, type, name, value = null) {
      const selectedCells = [...ui.editor.graph.selectionModel.cells];
      const graphXml = ui.editor.getGraphXml();
      const target = mxUtils.findNode(graphXml, "id", targetId);
      const msg = {
        prop: type === "property" ? "Property " + name + " " : "Handlers updated:"
      };

      if (type === "property") {
        if (value) {
          target.setAttribute(name, value);
          msg.action = "added on ";
        }
        else {
          target.removeAttribute(name);
          msg.action = "removed from ";
        }
      }
      else if (type === "handler") {
        const handlers = storeHandlers();
        msg.action = handlers[name] ? value ? " modified" : " deleted" : " added";

        /** Updates targetted handler */
        if (handlers[name]) {
          if (value)
            handlers[name] = value;
          else
            delete handlers[name];
        }
        else
          handlers[name] = value;

        /** Stores & stringifies handlers to get the node updated value */
        storeHandlers(true, handlers);
        const sep = live.handlers.separators;
        const handlersAttributeValue = Object.keys(handlers).map(
          (key) => `${key}${sep.pair}${handlers[key]}`
        ).join(sep.list);
        target.setAttribute(LIVE_HANDLERS, handlersAttributeValue);
      }

      ui.editor.setGraphXml(graphXml);
      ui.editor.graph.selectionModel.changeSelection(selectedCells);

      if (targetId === live.pageBaseId)
        msg.obj = "page base";
      else
        msg.obj = "object with id " + targetId;

      if (type === "property")
        log(msg.prop + msg.action + msg.obj);

      if (type === "handler")
        log(msg.prop + name + msg.action);
    }

    function storeHandlers(rebuild = false, computed = false) {
      if (!rebuild && Object.keys(live.handlers.list).length > 0)
        return live.handlers.list;

      if (computed) {
        live.handlers.list = computed;
        getHandlersMethods();
      }
      else {
        const graphXml = ui.editor.getGraphXml();
        const root = mxUtils.findNode(graphXml, "id", live.pageBaseId);
        const handlersStr = root.getAttribute(LIVE_HANDLERS);
        const sep = live.handlers.separators;
        const handlers = {};

        if(handlersStr) {
          /** Parses input string to work in handlers object */
          handlersStr.split(sep.list).forEach(
            (pair) => {
              const limit = pair.indexOf(sep.pair);
              const key = pair.slice(0, limit);
              const handler = pair.slice(limit + 1);
              handlers[key] = handler;
            }
          );
          live.handlers.list = handlers;
          getHandlersMethods();
        }
        else
          live.handlers.list = {};
      }
      return live.handlers.list;
    }

    /**
     * Transforms raw API response to exploitable data depending on source
     * @param {object} raw Raw received API response
     * @param {object} computationDataset Required data to compute exploitable data from API raw response
     * @returns computed exploitable data
     */
    function buildExploitableData(raw, computationDataset = {}) {
      const {source, post, apitypeId} = computationDataset;
      const postProcessed = (post) ? post(raw) : raw;

      if (post && !postProcessed)
        throw Error("'post' function for apitype " + apitypeId + " can't compute an exploitable object");

      const exploitable = new Function(
        "rawResponse",
        `return rawResponse${(source) ? "." + source : ""};`
      )(postProcessed);

      if (!exploitable) {
        const withPost = (post) ? "after " + apitypeId + " post process" : "";
        const withSource = (source) ? "with given path: " + source : "";
        throw Error(`No data available from API ${withPost} ${withSource}`);
      }
      return exploitable;
    }

    /** Stops refresh process & prevents multiple threads */
    function clearThread(threadId) {
      clearTimeout(threadId);
      live.thread = null;
    }

    /**
     * Updates live status buttons in Live Palette according to current working status
     * @param {boolean} isRunningStatus Plugin current working status
     * @param {boolean} isInit True in case of palette init
     */
     function updateLivePalette(isRunningStatus = true, isInit = false) {
      //! Do not run if not initialized
      if (!ui.isLivePluginEnabled)
        return;

      live.isRunning = isRunningStatus;
      const buttons = [live.paletteButtons[live.isRunning ? "pause" : "start"]];

      if (isInit)
        buttons.unshift(live.paletteButtons.reload);
      else
        ui.toolbar.container.removeChild(ui.toolbar.container.lastChild);

      buttons.forEach(
        ([label, tooltip, funct]) => ui.toolbar.addMenuFunction(
          label,
          tooltip,
          true,
          funct,
          ui.toolbar.container
        )
      );
    }

    /** Single update */
    function singleUpdate() {
      if (live.thread !== null) {
        log("live thread already running, thread id: " + live.thread);
        return;
      }
      loadUpdatesData();
      doUpdate();
    }

    /** Loop on update process */
    function loopUpdate() {
      doUpdate();
      live.thread = setTimeout(loopUpdate, live.timeout);
    }

    /** Starts update process */
    function startScheduleUpdate() {
       if (live.thread !== null) {
        log("live thread already running, thread id: " + live.thread);
        return;
      }
      updateLivePalette(true);
      loadUpdatesData();
      loopUpdate();
    }

    /** Pauses live update process */
    function pauseScheduleUpdate() {
      clearThread(live.thread);
      updateLivePalette(false);
    }

    /** Resets live update parameters */
    function loadUpdatesData() {
      if (live.ids) delete live.ids;
      if (live.nodes) delete live.nodes;
      live.ids = [];
      live.nodes = [];
      live.timeout = 0;
      live.pageBaseId = ui.currentPage.root.getId();
      log("Base ID updated before data fetch:", live.pageBaseId)

      const graphXml = ui.editor.getGraphXml();
      const baseNode = mxUtils.findNode(graphXml, "id", live.pageBaseId);
      live.timeout = (+(baseNode.getAttribute(LIVE_REFRESH) + "000")) || 10000;
      live.nodes = findLiveNodes(graphXml);
    }
    /**
     * Gets credentials to perform requests to a distant api requiring authentication.
     * Use live root credentials data if url is prefixed by base's **LIVE_API** attribute,
     * otherwise use targetted graph node live attributes
     * @param {Node} node Targetted graph node
     * @param {Node} root Graph node with id = 0
     * @returns {object|undefined} credentials if exist or "undefined"
     */
    function getCredentials(node, root) {
      const credentials = {};
      for(const crd of live.credentials) {
        if(node.getAttribute(crd))
          credentials[crd.slice(5)] = node.getAttribute(crd);
        else
          credentials[crd.slice(5)] = root.getAttribute(crd);
      }
      return (credentials.username || credentials.apikey) ? credentials : undefined;
    }

    /**
     * Computes the url to request the corresponding API
     * @param {string} url Value stored in live attribute
     * @param {Node} node Targetted graph object
     * @param {Node} root Graph root node
     * @returns {string} The computed request url
     */
    function buildUrl(url, node, root) {
      const nodeApi = node.getAttribute(LIVE_API);
      const rootApi = root.getAttribute(LIVE_API);
      let request = "";

      if (url) {
        if (url.startsWith("http://"))
          request = url;
        else if (url.startsWith("https://"))
          request = url;
        else if (url.startsWith("/") && nodeApi)
          request = nodeApi + url;
        else if (url.startsWith("/") && rootApi)
          request = rootApi + url;
        else if (url.startsWith("/"))
          request = url;
        else
          request = null;
      }
      else {
        if (nodeApi)
          request = nodeApi;
        else if (rootApi)
          request = rootApi;
        else
          request = null;
      }

      if (request === null)
        throw Error("url pattern is wrong: ", url);

      return request;
    }

    /**
     * Checks recursively in xml tree & stores nodes containing live attributes
     * @param {Node} graphElement Current checked graph node
     * @param {Array} liveNodes List of identified graph live nodes
     */
    function findLiveNodes(graphElement, liveNodes = []) {
      // base not is not checked
      if(graphElement.getAttribute("id") !== live.pageBaseId) {
        const elementId = graphElement.getAttribute("id");

        // checks if current node is live
        let isLiveElement = false;
        for (const attribute of graphElement.attributes) {
          if(live.isLiveAttribute(attribute.name)) {
            isLiveElement = true;
            break;
          }
        }

        // stores element id if element is live
        if(isLiveElement) {
          if(elementId !== null) {
            const liveNode = { id: elementId, elt: graphElement };
            if(graphElement.nodeName === "mxCell") liveNode.isCell = true;
            liveNodes.push(liveNode);
          }
        }
      }

      // if current element has children, finds live children
      if(graphElement.children.length > 0)
        liveNodes = findLiveNodes(graphElement.firstChild, liveNodes);

      // performs check for sibling
      const sibling = graphElement.nextElementSibling;
      if(sibling !== null)
        liveNodes = findLiveNodes(sibling, liveNodes);

      return liveNodes;
    }

    /**
     * Computes path to access data from request response depending on stored
     * apitypes targetted with its id stored in **LIVE_APITYPE** attributes,
     * or with **LIVE_SOURCE** attributes in object & graph base
     * @param {Node} node Current handled graph node
     * @param {Node} root Graph root node
     * @returns {object} Object containing data to  Path from or method to
     * transform corresponding api response in order to get an exploitable object
     */
    function getDataToFinalizeResponse(node, root) {
      /**
       * Gets data if "live.apitype" attribute is set in selected node
       * @param {Node} currentNode Current selected node
       * @param {string} currentSource Value for "live.source" attribute in currentNode
       * @returns {object} Dataset required to get exploitable data from API response
       */
      function getFromApitype(currentNode, currentSource) {
        const apitype = currentNode.getAttribute(LIVE_APITYPE);
        if (!apitype)
          return false;

        const targettedApi = live.apitypes.find(api => api.id === apitype);
        if (!targettedApi) {
          setWarning(LIVE_APITYPE, node.getAttribute("id"), "Value set does not match any identified apitype");
          return false;
        }

        return {
          apitypeId: targettedApi.id,
          post: targettedApi.post,
          source: (currentSource) ? currentSource : targettedApi.source
        };
      }
      const targetSource = node.getAttribute(LIVE_SOURCE);
      const baseSource = root.getAttribute(LIVE_SOURCE);

      if (getFromApitype(node, targetSource))
        return getFromApitype(node, targetSource);
      else if (targetSource)
        return {source: targetSource};
      else if (getFromApitype(root, baseSource))
        return getFromApitype(root, baseSource);
      else if (baseSource)
        return {source: baseSource};

      return undefined;
    }

    /**
     * Adds to the graph object update node the
     * updated value for corresponding attribute
     * @param {Node} updateNode XML node containing graph object update data
     * @param {string} attrName Graph object attribute name
     * @param {string} attrValue Graph object attribute updated value
     * @param {string} initialTargetStyle Targetted graph node style before update
     */
    function fillUpdateNode(updateNode, attrName, attrValue, initialTargetStyle) {
      /**
       * Set updates for Text & Tooltip Live Attributes
       * @param {boolean} isText `true` if current live attribute is Text
       * @returns The updated value
       */
      function setTextUpdates(isText) {
        const updatedValue = `${isText ? "label":"tooltip"}="${attrValue}" />`;
        const previousValue = updateNode.getAttribute("value");

        if (previousValue)
          updateNode.setAttribute("value", previousValue.replace("/>", updatedValue));
        else
          updateNode.setAttribute("value", `<object ${updatedValue}`);
      }

      if ([LIVE_TEXT, LIVE_TOOLTIP].includes(attrName))
        setTextUpdates(attrName === LIVE_TEXT);
      else if (attrName === LIVE_STYLE)
        updateNode.setAttribute("style", attrValue);
      else {
        // Checks if style has already been updated by another attribute
        let currentStyle = undefined;
        if (updateNode.hasAttribute("style"))
          currentStyle = updateNode.getAttribute("style");
        else
          currentStyle = initialTargetStyle;

        const updatedStyle = mxUtils.setStyle(currentStyle, live.property.getName(attrName), attrValue);
        updateNode.setAttribute("style", updatedStyle);
      }
    }

    /**
     * Requests an extarnal API & returns parsed received response
     * @param {string} url Url to request API
     * @param {boolean} isStringResponse True if API returns a simple response (string)
     * False if returns a complex response
     * @param {object} credentials Object containing API authentication data
     * @returns {string|object} Parsed API response
     */
     function computeApiResponse(url, isStringResponse, credentials) {
      /**
       * Sets value for Authorization request header to access a protected API
       * @param {object} credentials Object containing request credentials
       * @returns {string} Value for the header
       */
      function getAuthorizationValue(credentials) {
        const {username, password, apikey} = credentials;

        if (apikey)
          return "Bearer " + apikey;
        else if (username && password)
          return "Basic " + btoa(`${username}:${password}`);
        else
          throw Error("Credentials malformed");
      }

      try {
        let response = undefined;
        if (credentials) {
          const authorization = getAuthorizationValue(credentials);

          const xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.withCredentials = true;

          const headers = [
            ["Authorization", authorization]
          ];

          headers.forEach(([name, value]) => xhr.setRequestHeader(name, value));

          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
              if (xhr.status >= 200 && xhr.status < 300)
                response = xhr.responseText.trim();
              else
                throw Error("Request failed with status " + xhr.status);
            }
          }
          xhr.send();
        }
        else {
          response = mxUtils.load(url).getText().trim();
          if (response === live.mxUtilsRequestErrorMsg)
            throw Error("No response received from request");
        }

        if (isStringResponse)
          return response.replace(/"/g, "").trim();

        return JSON.parse(response);
      }
      catch (e) {
        throw Error("Error attempting to fetch data from " + url + ": " + e.message);
      }
    }

    /**
     * Handles case of mxCell containing live attributes without a parent object.
     * Moves live attributes from containing mxCell to its \<userObject> parent created by update process
     * @param {string} cellId Live cell's
     */
    function upgradeCellLiveNode(cellId) {
      const graphXml = ui.editor.getGraphXml();
      const parent = mxUtils.findNode(graphXml, "id", cellId);
      const cell = parent.firstChild;

      live.all.forEach(liveAttribute => {
        if(cell.hasAttribute(liveAttribute)) {
          parent.setAttribute(liveAttribute, cell.getAttribute(liveAttribute));
          cell.removeAttribute(liveAttribute);
        }
      });
      ui.editor.setGraphXml(graphXml);
    }

    /**
     * Parses a string stored in handlers to an available function.
     * @param {string} handler String containing the function definition
     * @returns {Function} Parsed function
     */
    function parseStringHandler(handler) {
      function getArgs() {
        return handler.slice(
          handler.indexOf("(") + 1,
          handler.indexOf(")"),
        ).split(",").map(arg => arg.trim());
      }
      handler.trim();
      const isArrowFunctionWithOneArg = (
        !handler.startsWith("function") && !handler.startsWith("(")
      );
      const isNotArrowFunction = handler.startsWith("function");

      const args = isArrowFunctionWithOneArg ? [
        handler.slice(0, handler.indexOf("=>")).trim()
      ] : getArgs();

      const instructions = isNotArrowFunction ? handler.slice(
        handler.indexOf("{")
      ) : handler.slice(handler.indexOf("=>") + 2).trim();

      try {
        return new Function(
          ...args,
          `${instructions.startsWith("{") ? "" : "return "}${instructions}`
        );
      } catch(e) {
        throw Error(
          "Given string cannot be parsed to an available function. " +
          "You should make sure that it is properly written."
        );
      }
    }

    /**
     * Parses handlers methods from given string inputs.
     * Creates an object containing associated JS methods for every
     * stored handler key which is returned & stored in `live.handlers.parsed`.
     * @returns {{handlerName: Function}} Parsed handlers
     */
    function getHandlersMethods() {
      const handlers = {};
      Object.keys(live.handlers.list).forEach(
        (handlerKey) => {
          try {
            handlers[handlerKey] = parseStringHandler(live.handlers.list[handlerKey]);
            setWarning("handler", handlerKey);
          }
          catch(e) {
            setWarning("handler", handlerKey, e.message);
          }
        }
      );
      live.handlers.parsed = handlers;
      return handlers;
    }

    /**
     * Computes attribute updated value using fechted named APIs
     * responses & instructions set in live attribute value
     * @param {[{response, ref}]} apiResponses List of named APIs
     * @param {string} nodeApiRef Current graph node's API reference
     * @param {string} instructions Scope containing JS instructions
     * @returns {string} The updated value for targetted live attribute
     */
    function updateLiveAttribute(apiResponses, nodeApiRef, instructions) {
      const selfApiResponse = apiResponses[nodeApiRef];
      const handlerKeys = Object.keys(live.handlers.parsed);
      const handlerMethods = handlerKeys.map(name => live.handlers.parsed[name]);
      const updatedValue = new Function(
        "data",
        "self",
        ...handlerKeys,
        instructions.slice(1)
      )(apiResponses, selfApiResponse, ...handlerMethods);

      if(!updatedValue)
        throw Error("Instructions set didn't return anything");

      return updatedValue;
    }

    /** Performs an update process */
    function doUpdate() {
      clearThread(live.thread);
      clearWarnings();
      const graphXml = ui.editor.getGraphXml();
      const baseNode = mxUtils.findNode(graphXml, "id", live.pageBaseId);

      /** Initiates the xml doc to perform the updates & the arrays which store APIs data */
      const xmlUpdatesDoc = mxUtils.createXmlDocument();
      const updatesList = xmlUpdatesDoc.createElement("updates");
      const namedApis = [];
      const anonApis = [];

      /** Fetches all targetted api responses first to fill namedApis */
      live.nodes.forEach((currentLiveNode) => {
        const { elt: liveNode, id } = currentLiveNode;
        if (!id)
          return;

        const apiRef = liveNode.getAttribute(LIVE_REF);
        const apiData = liveNode.getAttribute(LIVE_DATA);

        /** Handles warning messages if user inputs are bad */
        try {
          if (!apiData) {
            if (apiRef)
              throw Error("There is no data to reference");
            return;
          }
          else if (!apiRef) {
            throw Error("No reference for data: API will not be accessible from another graph element");
          }
        }
        catch (e) {
          const targettedAttribute = apiData ? LIVE_REF : LIVE_DATA;
          setWarning(targettedAttribute, id, e.message);
          if (!apiData)
            return;
        }

        /** Computes & stores api responses */
        try {
          /** Builds dataset (url, credentials, sources) to perform the request */
          const url = buildUrl(apiData, liveNode, baseNode);
          let exploitableResponse = undefined;
          const isAlreadyComputed = namedApis.find(api => api.url === url);

          /**
           * Checks if corresponding url response is already
           * computed in order to prevent multi calls on same API
           */
          if (isAlreadyComputed)
            exploitableResponse = isAlreadyComputed.response;
          else {
            const credentials = getCredentials(liveNode, baseNode);
            const rawResponse = computeApiResponse(url, false, credentials);
            const dataset = getDataToFinalizeResponse(liveNode, baseNode);
            exploitableResponse = buildExploitableData(rawResponse, dataset);
          }
          namedApis.push({
            response: exploitableResponse,
            ref: apiRef || id,
            url
          });
        }
        catch(e) {
          setWarning(LIVE_DATA, id, e.message);
        }
      });

      /** Stores all apis responses with their ref to access them in other graph nodes */
      const apiResponses = {};
      namedApis.forEach(({ref, response}) => apiResponses[ref] = response);

      /** Updates live attributes for every stored live node */
      live.nodes.forEach((liveNode) => {
        if (!liveNode.id)
          return;

        /** Creates an update node which stores updates for all targetted live nodes */
        const updateNode = xmlUpdatesDoc.createElement("update");
        updateNode.setAttribute("id", liveNode.id);

        /** Gets selected graph node's style to prevent style rewriting */
        const style = (
          liveNode.elt.firstChild.getAttribute("style") ||
          liveNode.elt.getAttribute("style")
        );

        for (const {name: attrName, value: attrValue} of liveNode.elt.attributes) {
          /** Handles attribute if attribute is valid live one */
          if (live.isAvailableLiveAttribute(attrName)) {
            try {
              let updatedValue = "";
              if (live.isAnonAttribute(attrValue)) {
                const url = buildUrl(attrValue, liveNode.elt, baseNode);
                const targettedAnonApi = anonApis.find(api => api.url === url);

                if (targettedAnonApi) {
                  updatedValue = targettedApi.response;
                }
                else {
                  const credentials = getCredentials(liveNode.elt, baseNode);
                  updatedValue = computeApiResponse(url, true, credentials);
                  anonApis.push({url, response: updatedValue});
                }
              }
              else {
                const nodeRef = liveNode.elt.getAttribute(LIVE_REF) || liveNode.id;
                updatedValue = updateLiveAttribute(apiResponses, nodeRef, attrValue);
              }
              fillUpdateNode(updateNode, attrName, updatedValue, style);
            }
            catch (e) {
              setWarning(attrName, liveNode.id, e.message);
            }
          }
        };
        updatesList.appendChild(updateNode);
      });

      // Appends "updates" filled node to the new doc & updates diagram
      xmlUpdatesDoc.appendChild(updatesList);
      ui.updateDiagram(mxUtils.getXml(xmlUpdatesDoc));

      /** Upgrades unwrapped graph live nodes */
      live.nodes.forEach(
        liveNode => {
          if (liveNode.isCell) {
            upgradeCellLiveNode(liveNode.id);
            delete liveNode.isCell;
          }
        }
      );
    }

    /**
     * Stores a warning for a graph element live attribute in live.warnings
     * @param {string} attribute Targetted live attribute | "handler"
     * @param {string} objectId Targetted graph object id | handler name
     * @param {string} message Warning message to store
     */
    function setWarning(attribute, objectId, message = undefined) {
      if(message === undefined) {
        if(live.warnings[attribute] && (live.warnings[attribute][objectId]))
          delete live.warnings[attribute][objectId];
      }
      else {
        if (!live.warnings[attribute])
          live.warnings[attribute] = {};
        if (!live.warnings[attribute][objectId])
          live.warnings[attribute][objectId] = [];
        if (!live.warnings[attribute][objectId].some(warn => warn === message)) {
          live.warnings[attribute][objectId].push(message);

          let introMsg = "Warning on ";
          if(attribute === "handler")
            introMsg += "'" + objectId + "'" + " handler: ";
          else
            introMsg += attribute + " in object " + objectId + ": ";

          log(introMsg, message);
        }
      }
    }

    /**
     * Searches in live.warnings if the live attribute of a graph object has a saved warning
     * In handlers case, objectId === handler name
     * @param {string} attribute Targetted live attribute | "handler"
     * @param {string|} nodeId Targetted graph object id | handler name
     * @returns {string} object attribute's corresponding id or an empty string
     */
    function getWarning(attribute, nodeId) {
      if(!live.warnings[attribute] || !live.warnings[attribute][nodeId])
        return "";
      else
        return live.warnings[attribute][nodeId].join("\n");
    }

    function clearWarnings() {
      if(live.warnings.handler) {
        const handler = {...live.warnings.handler};
        live.warnings = { handler };
      }
      else
        live.warnings = {};
    }

    function log(...text) {
      console.log("%cLive plugin:%c",
        "text-decoration: underline dotted", "",
        ...text,
      );
    }

    initPlugin();
  }
);
