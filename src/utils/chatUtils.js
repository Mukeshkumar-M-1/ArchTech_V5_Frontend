import { sendChatMessage, sendChatInteraction } from "../api/chatApi";

export const handleChatSend = async ({
  chatInput,
  isStreaming,
  isAwaitingUserInput,
  selectedChatBlocks,
  currentSessionId,
  activeProject,
  abortControllerRef,
  setChatInput,
  setChatMessages,
  setIsStreaming,
  setSelectedChatBlocks,
  setCurrentSessionId,
  setIsAwaitingUserInput,
  setPendingToolCallId,
}) => {
  if (!chatInput.trim() || isStreaming || isAwaitingUserInput) return;
  const projectId = activeProject?.id || null;
  const sessionId = activeProject?.id || null;
  const userMsg = chatInput.trim();
  setChatInput("");
  const contextBlocksToPass = selectedChatBlocks.length > 0 ? selectedChatBlocks : null;
  if (selectedChatBlocks.length > 0) {
    setSelectedChatBlocks([]);
  }

  setChatMessages((prevMessages) => [...prevMessages, { role: "user", content: userMsg, contextBlocks: contextBlocksToPass }]);
  setIsStreaming(true);

  // Create session if needed
  if (!currentSessionId) {
    setCurrentSessionId(sessionId);
  }

  const abortController = new AbortController();
  abortControllerRef.current = abortController;

  try {
    const stream = sendChatMessage({
      message: userMsg,
      session_id: currentSessionId,
      project_id: projectId,
      signal: abortController.signal,
      contextBlocks: contextBlocksToPass,
    });
    for await (const event of stream) {
      console.log("[ChatSSE] event:", event.type, event.tool_call_id || "");
      const { type, content } = event;

      if (type === "session_created") {
        setCurrentSessionId(event.session_id);
      } else if (type === "text_delta") {
        setChatMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          if (lastMessage?.role === "bot" && lastMessage._streaming) {
            return [
              ...prevMessages.slice(0, -1),
              { ...lastMessage, content: lastMessage.content + (content || "") },
            ];
          }
          return [
            ...prevMessages,
            { role: "bot", content: content || "", _streaming: true },
          ];
        });
      } else if (type === "tool_use_start") {
        setChatMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          if (lastMessage?.role === "bot" && lastMessage._streaming) {
            // Close the streaming bot text before starting a tool execution
            updatedMessages[updatedMessages.length - 1] = {
              ...lastMessage,
              _streaming: false,
            };
          }
          return [
            ...updatedMessages,
            {
              role: "tool",
              tool_call_id: event.tool_call_id,
              name: event.name,
              input: event.input,
              status: "executing",
            },
          ];
        });
      } else if (type === "tool_use_complete") {
        setChatMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.role === "tool" && msg.tool_call_id === event.tool_call_id
              ? { ...msg, status: "completed", output: event.output }
              : msg,
          ),
        );
      } else if (type === "tool_error") {
        setChatMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.role === "tool" && msg.tool_call_id === event.tool_call_id
              ? { ...msg, status: "error", error: event.error }
              : msg,
          ),
        );
      } else if (type === "tool_interaction_request") {
        setChatMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.role === "tool" && msg.tool_call_id === event.tool_call_id
              ? {
                  ...msg,
                  status: "awaiting_input",
                  ui_type: event.ui_type,
                  options: event.options,
                  prompt: event.prompt,
                }
              : msg,
          ),
        );
      } else if (type === "done") {
        // Finalize streaming message
        setChatMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          if (lastMessage?.role === "bot" && lastMessage._streaming) {
            return [
              ...prevMessages.slice(0, -1),
              {
                ...lastMessage,
                content: content || lastMessage.content,
                _streaming: false,
              },
            ];
          } else if (content) {
            return [...prevMessages, { role: "bot", content }];
          }
          return prevMessages;
        });
        setIsAwaitingUserInput(false);
        setPendingToolCallId(null);
      } else if (type === "error") {
        setChatMessages((prevMessages) => [
          ...prevMessages,
          { role: "bot", content: `Error: ${event.message}` },
        ]);
      } else if (type === "interaction_paused") {
        // The message was already added by tool_use_start and updated by tool_interaction_request
        // Just set the global states to pause for input

        setIsAwaitingUserInput(true);
        setPendingToolCallId(event.tool_call_id);
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      setChatMessages((prevMessages) => [
        ...prevMessages,
        { role: "bot", content: `Error: ${err.message}` },
      ]);
    }
  } finally {
    setIsStreaming(false);
    setIsAwaitingUserInput(false);
    setPendingToolCallId(null);
    abortControllerRef.current = null;
  }
};

export const handleStopChat = (abortControllerRef) => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
};

export const handleInteractionSubmit = async ({
  session_id,
  tool_call_id,
  response,
  setChatMessages,
}) => {
  try {
    const data = await sendChatInteraction({ session_id, tool_call_id, response });
    if (data?.status === "resumed") {
      setChatMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.role === "tool" && msg.tool_call_id === tool_call_id
            ? {
                ...msg,
                status: "completed",
                output: `User selection: ${JSON.stringify(response)}`,
              }
            : msg,
        ),
      );
    }
  } catch (err) {
    setChatMessages((prevMessages) => [
      ...prevMessages,
      { role: "bot", content: `Interaction error: ${err.message}` },
    ]);
  }
};
