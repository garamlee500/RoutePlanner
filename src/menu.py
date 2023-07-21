from typing import Union, Tuple, List, Callable, Literal
import math


class Menu:
    # Options should have a name with either a submenu to call
    # or a function to call that is completely void with no arguments
    def __init__(self, options: List[Tuple[str, Union['Menu', Callable[[], None]]]] = None, start_text=None, loop=True):
        if options is None:
            self._options = []
        else:
            self._options: List[Tuple[str, Union['Menu', Callable[[], None]]]] = options
        self._start_text = start_text
        self._loop = loop

    def add_option(self, option: Tuple[str, Union['Menu', Callable[[], None]]]):
        self._options.append(option)

    @staticmethod
    def prompt_integer(lower_bound: Union[int, Literal[-math.inf]], upper_bound: Union[int, Literal[math.inf]]) -> int:
        # Prompts for an integer x, where min <= x < max until a valid one is entered
        current = upper_bound
        while current < lower_bound or current >= upper_bound:
            input_string = input()
            try:
                current = int(input_string)
                if current < lower_bound or current >= upper_bound:
                    print("Invalid number entered. Please try again:")
            except ValueError:
                print("Invalid number entered. Please try again:")

        return current

    @staticmethod
    def prompt_float(lower_bound: float, upper_bound: float) -> float:
        # Prompts for a float x, where min <= x < max until a valid one is entered
        current = upper_bound
        while current < lower_bound or current >= upper_bound:
            input_string = input()
            try:
                current = float(input_string)
                if current < lower_bound or current >= upper_bound:
                    print("Invalid number entered. Please try again:")
            except ValueError:
                print("Invalid number entered. Please try again:")
        return current


    def run(self):
        while True:
            if type(self._start_text) is str:
                print(self._start_text)
            elif callable(self._start_text):
                print(self._start_text())

            print("0. Back")

            for i, option in enumerate(self._options):
                print(f"{i + 1}: {option[0]}")

            chosen_option = Menu.prompt_integer(0, len(self._options) + 1)

            if chosen_option == 0:
                break

            if type(self._options[chosen_option - 1][1]) is Menu:
                self._options[chosen_option - 1][1].run()
            else:
                self._options[chosen_option - 1][1]()

            if not self._loop:
                break
