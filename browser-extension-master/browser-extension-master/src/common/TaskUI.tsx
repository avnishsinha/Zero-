import { HStack, Spacer, Textarea, useToast } from '@chakra-ui/react';
import React, { useCallback, useEffect, useState } from 'react';
import { debugMode } from '../constants';
import { useAppState } from '../state/store';
import RunTaskButton from './RunTaskButton';
import TaskHistory from './TaskHistory';
import TaskStatus from './TaskStatus';
import MicRecorder from 'mic-recorder-to-mp3';

const Mp3Recorder = new MicRecorder({ bitRate: 128 });

const TaskUI = () => {
  const state = useAppState((state) => ({
    taskHistory: state.currentTask.history,
    taskStatus: state.currentTask.status,
    runTask: state.currentTask.actions.runTask,
    instructions: state.ui.instructions,
    setInstructions: state.ui.actions.setInstructions,
  }));

  const [isRecording, setIsRecording] = useState(false);
  const [blobURL, setBlobURL] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(() => {
        console.log('Permission Granted');
        setIsBlocked(false);
      })
      .catch(() => {
        console.log('Permission Denied');
        setIsBlocked(true);
      });
  }, []);

  const taskInProgress = state.taskStatus === 'running';

  const toast = useToast();

  const toastError = useCallback(
    (message: string) => {
      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    },
    [toast]
  );

  const runTask = () => {
    state.instructions && state.runTask(toastError);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runTask();
    }
  };

  const toggleRecording = () => {
    if (isBlocked) {
      console.log('Permission Denied');
      throw Error('Recording blocked');
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    Mp3Recorder.start()
      .then(() => {
        setIsRecording(true);
      })
      .catch((e) => console.error(e));
  };

  const stopRecording = () => {
    Mp3Recorder.stop()
      .getMp3()
      .then(([buffer, blob]: any) => {
        const blobURL = URL.createObjectURL(blob);
        setBlobURL(blobURL);
        setIsRecording(false);

        const formData = new FormData();
        formData.append('audio', blob, 'audio.mp3');

        fetch('http://localhost:5000/', {
          method: 'POST',
          body: formData,
        })
          .then((response) => response.json())
          .then((data) => {
            console.log('Success:', data);
            if (data.transcript) {
              state.setInstructions(data.transcript);
              state.runTask((e: any) => {
                console.error(e);
              });
            }
          })
          .catch((error) => {
            console.error('Error:', error);
          });
      })
      .catch((e: any) => console.error(e));
  };

  return (
    <>
      <HStack mb={2}>
        <button onClick={toggleRecording}>
          {isRecording ? 'Stop' : 'Record'}
        </button>
        <audio src={blobURL} controls="controls" />
      </HStack>
      <Textarea
        autoFocus
        placeholder="Eg. Search for Google Calendar, open it, create a new task titled 'Finish essay'"
        value={state.instructions || ''}
        disabled={taskInProgress}
        onChange={(e) => state.setInstructions(e.target.value)}
        mb={2}
        onKeyDown={onKeyDown}
      />

      <HStack>
        <RunTaskButton runTask={runTask} />
        <Spacer />
        {debugMode && <TaskStatus />}
      </HStack>
      <TaskHistory />
    </>
  );
};

export default TaskUI;
