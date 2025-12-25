# Auto-generated test module for auth_api_测试
import os
from atf.core.log_manager import log
from atf.core.globals import Globals
from atf.core.variable_resolver import VariableResolver
from atf.core.request_handler import RequestHandler
from atf.core.assert_handler import AssertHandler
import allure
import yaml

@allure.epic('default')
@allure.feature('Auth API')
class TestAuthApi测试:
    @classmethod
    def setup_class(cls):
        log.info('========== 开始执行测试用例：test_auth_api_测试 (测试用户认证相关接口) ==========')
        cls.test_case_data = cls.load_test_case_data()
        cls.steps_dict = {step['id']: step for step in cls.test_case_data['steps']}
        cls.session_vars = {}
        cls.global_vars = Globals.get_data()
        cls.testcase_host = 'http://localhost:8000'
        cls.VR = VariableResolver(global_vars=cls.global_vars, session_vars=cls.session_vars)
        log.info('Setup completed for TestAuthApi测试')

    @staticmethod
    def load_test_case_data():
        yaml_path = os.path.join(os.path.dirname(__file__), '..', 'cases', 'auth.yaml')
        with open(yaml_path, 'r', encoding='utf-8') as file:
            test_case_data = yaml.safe_load(file)['testcase']
        return test_case_data

    @allure.story('用户认证')
    def test_auth_api_测试(self):
        log.info('Starting test_auth_api_测试')
        # Step: login_step
        log.info(f'开始执行 step: login_step')
        login_step = self.steps_dict.get('login_step')
        step_host = self.testcase_host
        response = RequestHandler.send_request(
            method=login_step['method'],
            url=step_host + self.VR.process_data(login_step['path']),
            headers=self.VR.process_data(login_step.get('headers')),
            data=self.VR.process_data(login_step.get('data')),
            params=self.VR.process_data(login_step.get('params')),
            files=self.VR.process_data(login_step.get('files'))
        )
        log.info(f'login_step 请求结果为：{response}')
        self.session_vars['login_step'] = response
        db_config = None
        AssertHandler().handle_assertion(
            asserts=self.VR.process_data(login_step['assert']),
            response=response,
            db_config=db_config
        )

        # Step: health_check_step
        log.info(f'开始执行 step: health_check_step')
        health_check_step = self.steps_dict.get('health_check_step')
        step_host = self.testcase_host
        response = RequestHandler.send_request(
            method=health_check_step['method'],
            url=step_host + self.VR.process_data(health_check_step['path']),
            headers=self.VR.process_data(health_check_step.get('headers')),
            data=self.VR.process_data(health_check_step.get('data')),
            params=self.VR.process_data(health_check_step.get('params')),
            files=self.VR.process_data(health_check_step.get('files'))
        )
        log.info(f'health_check_step 请求结果为：{response}')
        self.session_vars['health_check_step'] = response
        db_config = None
        AssertHandler().handle_assertion(
            asserts=self.VR.process_data(health_check_step['assert']),
            response=response,
            db_config=db_config
        )


        log.info(f"Test case test_auth_api_测试 completed.")
