# Auto-generated test module for settings_api_测试
import os
from atf.core.log_manager import log
from atf.core.globals import Globals
from atf.core.variable_resolver import VariableResolver
from atf.core.request_handler import RequestHandler
from atf.core.assert_handler import AssertHandler
import allure
import yaml

@allure.epic('default')
@allure.feature('Settings API')
class TestSettingsApi测试:
    @classmethod
    def setup_class(cls):
        log.info('========== 开始执行测试用例：test_settings_api_测试 (测试系统设置相关接口) ==========')
        cls.test_case_data = cls.load_test_case_data()
        cls.steps_dict = {step['id']: step for step in cls.test_case_data['steps']}
        cls.session_vars = {}
        cls.global_vars = Globals.get_data()
        cls.testcase_host = 'http://localhost:8000'
        cls.VR = VariableResolver(global_vars=cls.global_vars, session_vars=cls.session_vars)
        log.info('Setup completed for TestSettingsApi测试')

    @staticmethod
    def load_test_case_data():
        yaml_path = os.path.join(os.path.dirname(__file__), '..', 'cases', 'settings.yaml')
        with open(yaml_path, 'r', encoding='utf-8') as file:
            test_case_data = yaml.safe_load(file)['testcase']
        return test_case_data

    @allure.story('系统设置')
    def test_settings_api_测试(self):
        log.info('Starting test_settings_api_测试')
        # Step: get_settings_step
        log.info(f'开始执行 step: get_settings_step')
        get_settings_step = self.steps_dict.get('get_settings_step')
        step_host = self.testcase_host
        response = RequestHandler.send_request(
            method=get_settings_step['method'],
            url=step_host + self.VR.process_data(get_settings_step['path']),
            headers=self.VR.process_data(get_settings_step.get('headers')),
            data=self.VR.process_data(get_settings_step.get('data')),
            params=self.VR.process_data(get_settings_step.get('params')),
            files=self.VR.process_data(get_settings_step.get('files'))
        )
        log.info(f'get_settings_step 请求结果为：{response}')
        self.session_vars['get_settings_step'] = response
        db_config = None
        AssertHandler().handle_assertion(
            asserts=self.VR.process_data(get_settings_step['assert']),
            response=response,
            db_config=db_config
        )


        log.info(f"Test case test_settings_api_测试 completed.")
